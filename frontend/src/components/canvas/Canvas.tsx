"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCanvasStore } from "@/store/canvas";
import type { Cursor, Shape as ShapeData, ShapeType } from "@/lib/types";
import {
  SHAPE_META,
  defaultColumns,
  defaultLabel,
  shapeHeight,
  shapeWidth,
} from "@/lib/shapeConfig";
import { buildSpecMarkdown, downloadText } from "@/lib/exportSpec";
import Shape from "./Shape";
import Edge from "./Edge";
import CursorOverlay from "./CursorOverlay";
import SelectionBar from "./SelectionBar";
import ShapeEditor from "./ShapeEditor";
import EdgeBar from "./EdgeBar";
import ShapeLibrary, { DRAG_MIME } from "./ShapeLibrary";
import MenuToolbar from "./MenuToolbar";
import Inspector from "./Inspector";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

interface View {
  x: number; // pan offset in screen pixels
  y: number;
  zoom: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Zoom while keeping the point (px, py) fixed on screen. */
function zoomAround(view: View, factor: number, px: number, py: number): View {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const k = zoom / view.zoom;
  return { zoom, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "diagram"
  );
}

interface CanvasProps {
  projectId: string;
  userId: string;
  /** Used for the names of exported files. */
  projectName?: string;
  onConnect: (projectId: string) => void;
  wsSend: (msg: { type: string; [key: string]: unknown }) => void;
}

export default function Canvas({
  projectId,
  userId,
  projectName = "Ghost AI diagram",
  onConnect,
  wsSend,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    shapes,
    edges,
    cursors,
    selectedShapeId,
    settings,
    tableView,
    canUndo,
    canRedo,
    addShape,
    updateShape,
    deleteShape,
    addEdge,
    updateEdge,
    deleteEdge,
    setSelectedShape,
    setTableView,
    updateSettings,
    loadDesign,
    undo,
    redo,
  } = useCanvasStore();

  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  // Which shape the user is drawing an arrow from (null = not drawing an arrow)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const pan = useRef<{ px: number; py: number; vx: number; vy: number; moved: boolean } | null>(
    null
  );
  const justPanned = useRef(false);

  useEffect(() => {
    onConnect(projectId);
  }, [projectId, onConnect]);

  // Start with the panels open on wide screens and closed on small ones.
  useEffect(() => {
    setLibraryOpen(window.innerWidth >= 768);
    setInspectorOpen(window.innerWidth >= 1536);
  }, []);

  // ---- Zoom ----------------------------------------------------------------
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Let panels scroll instead of zooming the canvas.
      if ((e.target as HTMLElement | null)?.closest?.("[data-canvas-ui]")) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => zoomAround(v, factor, px, py));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const el = canvasRef.current;
    if (!el) return;
    setView((v) => zoomAround(v, factor, el.clientWidth / 2, el.clientHeight / 2));
  }, []);

  const zoomTo = useCallback((zoom: number) => {
    const el = canvasRef.current;
    if (!el) return;
    setView((v) => zoomAround(v, zoom / v.zoom, el.clientWidth / 2, el.clientHeight / 2));
  }, []);

  // ---- Fit everything on screen --------------------------------------------
  const fitView = useCallback(() => {
    const el = canvasRef.current;
    if (!el || shapes.length === 0) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const minX = Math.min(...shapes.map((s) => s.x));
    const maxX = Math.max(...shapes.map((s) => s.x + shapeWidth(s)));
    const minY = Math.min(...shapes.map((s) => s.y));
    const maxY = Math.max(...shapes.map((s) => s.y + shapeHeight(s)));
    const bw = maxX - minX;
    const bh = maxY - minY;
    const pad = 80;
    const zoom = clamp(Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh), MIN_ZOOM, 1.2);
    setView({
      zoom,
      x: (cw - bw * zoom) / 2 - minX * zoom,
      y: (ch - bh * zoom) / 2 - minY * zoom,
    });
  }, [shapes]);

  // When a whole design appears at once (from the AI, an import or a load), fit it on screen.
  const prevCount = useRef(0);
  useEffect(() => {
    const prev = prevCount.current;
    prevCount.current = shapes.length;
    if (shapes.length - prev >= 2) fitView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes.length]);

  // If undo removed the selected shape, clear the selection.
  useEffect(() => {
    if (selectedShapeId && !shapes.some((s) => s.id === selectedShapeId)) {
      setSelectedShape(null);
    }
  }, [shapes, selectedShapeId, setSelectedShape]);

  // ---- Snapping ------------------------------------------------------------
  const snapValue = useCallback(
    (value: number) =>
      settings.snap ? Math.round(value / settings.gridSize) * settings.gridSize : value,
    [settings.snap, settings.gridSize]
  );

  // ---- Shape and arrow actions ---------------------------------------------
  /** Add a shape. `at` is a point in canvas coordinates (a drop); without it, the middle of the view. */
  const handleAddShape = useCallback(
    (type: ShapeType, at?: { x: number; y: number }) => {
      const el = canvasRef.current;
      const cw = el?.clientWidth ?? 800;
      const ch = el?.clientHeight ?? 600;
      const columns = type === "entity" ? defaultColumns() : undefined;
      const w = shapeWidth({ type });
      const h = shapeHeight({ type, columns });

      let x: number;
      let y: number;
      if (at) {
        x = at.x - w / 2;
        y = at.y - h / 2;
      } else {
        const cx = (cw / 2 - view.x) / view.zoom;
        const cy = (ch / 2 - view.y) / view.zoom;
        x = cx - w / 2 + (Math.random() - 0.5) * 160;
        y = cy - h / 2 + (Math.random() - 0.5) * 120;
      }

      const id = crypto.randomUUID();
      const shape: ShapeData = {
        id,
        type,
        x: snapValue(x),
        y: snapValue(y),
        label: defaultLabel(type),
        ...(columns ? { columns } : {}),
      };
      addShape(shape);
      wsSend({ type: "shape_add", shape });
      setSelectedShape(id);
      setSelectedEdgeId(null);
    },
    [view, addShape, wsSend, setSelectedShape, snapValue]
  );

  const handleMoveShape = useCallback(
    (id: string, x: number, y: number) => {
      const nx = snapValue(x);
      const ny = snapValue(y);
      updateShape(id, { x: nx, y: ny });
      wsSend({ type: "shape_update", shape_id: id, changes: { x: nx, y: ny } });
    },
    [updateShape, wsSend, snapValue]
  );

  const saveShape = useCallback(
    (id: string, changes: Partial<ShapeData>) => {
      updateShape(id, changes);
      wsSend({ type: "shape_update", shape_id: id, changes });
    },
    [updateShape, wsSend]
  );

  // Dragging the resize arrow.
  const handleResizeShape = useCallback(
    (shape: ShapeData, w: number, h: number) => {
      saveShape(shape.id, { w: snapValue(w), h: snapValue(h) });
    },
    [saveShape, snapValue]
  );

  const handleChangeType = useCallback(
    (id: string, type: ShapeType) => {
      const current = shapes.find((s) => s.id === id);
      if (!current) return;
      // If the title is still the default name, rename it to match the new type.
      const wasDefault =
        current.label.trim() === "" ||
        current.label === defaultLabel(current.type) ||
        current.label === SHAPE_META[current.type]?.label ||
        current.label === `New ${current.type}`;
      const changes: Partial<ShapeData> = { type };
      if (wasDefault) changes.label = defaultLabel(type);
      if (type === "entity" && !current.columns?.length) changes.columns = defaultColumns();
      saveShape(id, changes);
    },
    [shapes, saveShape]
  );

  const removeShape = useCallback(
    (id: string) => {
      deleteShape(id); // the store also removes arrows attached to it
      wsSend({ type: "shape_delete", shape_id: id });
      setSelectedShape(null);
      setConnectingFrom(null);
      setEditingShapeId(null);
    },
    [deleteShape, wsSend, setSelectedShape]
  );

  const duplicateSelected = useCallback(() => {
    const source = shapes.find((s) => s.id === selectedShapeId);
    if (!source) return;
    const id = crypto.randomUUID();
    const copy: ShapeData = {
      ...source,
      id,
      x: source.x + 28,
      y: source.y + 28,
    };
    if (source.columns) copy.columns = source.columns.map((c) => ({ ...c }));
    addShape(copy);
    wsSend({ type: "shape_add", shape: copy });
    setSelectedShape(id);
  }, [shapes, selectedShapeId, addShape, wsSend, setSelectedShape]);

  const createEdge = useCallback(
    (from: string, to: string) => {
      if (from === to) return;
      if (edges.some((e) => e.from === from && e.to === to)) return;
      const edge = { id: crypto.randomUUID(), from, to };
      addEdge(edge);
      wsSend({ type: "edge_add", edge });
    },
    [edges, addEdge, wsSend]
  );

  const removeEdge = useCallback(
    (id: string) => {
      deleteEdge(id);
      wsSend({ type: "edge_delete", edge_id: id });
      setSelectedEdgeId(null);
    },
    [deleteEdge, wsSend]
  );

  // Change an arrow's label. Other users get it as a delete followed by an add.
  const commitEdgeLabel = useCallback(
    (id: string, label: string) => {
      const edge = edges.find((e) => e.id === id);
      if (!edge || (edge.label ?? "") === label) return;
      updateEdge(id, { label });
      wsSend({ type: "edge_delete", edge_id: id });
      wsSend({ type: "edge_add", edge: { ...edge, label } });
    },
    [edges, updateEdge, wsSend]
  );

  const clearSelection = useCallback(() => {
    setSelectedShape(null);
    setSelectedEdgeId(null);
    setConnectingFrom(null);
  }, [setSelectedShape]);

  const clearAll = useCallback(() => {
    if (shapes.length === 0) return;
    if (!window.confirm("Erase everything on this canvas? You can undo this with Ctrl+Z.")) return;
    shapes.forEach((s) => {
      deleteShape(s.id);
      wsSend({ type: "shape_delete", shape_id: s.id });
    });
    clearSelection();
  }, [shapes, deleteShape, wsSend, clearSelection]);

  const deleteSelection = useCallback(() => {
    if (selectedEdgeId) removeEdge(selectedEdgeId);
    else if (selectedShapeId) removeShape(selectedShapeId);
  }, [selectedEdgeId, selectedShapeId, removeEdge, removeShape]);

  const handleSelectShape = useCallback(
    (id: string) => {
      // While drawing an arrow, clicking another shape finishes it.
      if (connectingFrom && connectingFrom !== id) {
        createEdge(connectingFrom, id);
        setConnectingFrom(null);
      }
      setSelectedShape(id);
      setSelectedEdgeId(null);
    },
    [connectingFrom, createEdge, setSelectedShape]
  );

  // ---- Export and import ---------------------------------------------------
  const exportSpec = useCallback(() => {
    downloadText(`${slugify(projectName)}-spec.md`, buildSpecMarkdown(projectName, shapes, edges));
  }, [projectName, shapes, edges]);

  const exportJson = useCallback(() => {
    downloadText(
      `${slugify(projectName)}.json`,
      JSON.stringify({ shapes, edges }, null, 2),
      "application/json"
    );
  }, [projectName, shapes, edges]);

  const importJson = useCallback(
    async (file: File) => {
      try {
        const data = JSON.parse(await file.text());
        const rawShapes: unknown[] = Array.isArray(data?.shapes) ? data.shapes : [];
        const rawEdges: unknown[] = Array.isArray(data?.edges) ? data.edges : [];

        const importedShapes: ShapeData[] = [];
        const ids = new Set<string>();
        for (const item of rawShapes.slice(0, 200)) {
          const s = item as Record<string, unknown>;
          if (
            !s ||
            typeof s.id !== "string" ||
            typeof s.type !== "string" ||
            !(s.type in SHAPE_META) ||
            typeof s.x !== "number" ||
            typeof s.y !== "number" ||
            ids.has(s.id)
          ) {
            continue;
          }
          importedShapes.push({
            ...(s as unknown as ShapeData),
            label: typeof s.label === "string" ? s.label : "",
          });
          ids.add(s.id);
        }

        const importedEdges = rawEdges
          .filter((item) => {
            const e = item as Record<string, unknown>;
            return (
              e &&
              typeof e.id === "string" &&
              typeof e.from === "string" &&
              typeof e.to === "string" &&
              ids.has(e.from) &&
              ids.has(e.to)
            );
          })
          .slice(0, 600) as unknown as { id: string; from: string; to: string; label?: string }[];

        if (importedShapes.length === 0) {
          window.alert("That file has no diagram in it.");
          return;
        }
        loadDesign(importedShapes, importedEdges);
      } catch {
        window.alert("Could not read that file. Use a JSON file exported from Ghost AI.");
      }
    },
    [loadDesign]
  );

  // ---- Drag a shape in from the library ------------------------------------
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(e.dataTransfer.types).includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const type = e.dataTransfer.getData(DRAG_MIME);
    if (!type || !(type in SHAPE_META)) return;
    e.preventDefault();
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    handleAddShape(type as ShapeType, {
      x: (e.clientX - rect.left - view.x) / view.zoom,
      y: (e.clientY - rect.top - view.y) / view.zoom,
    });
  };

  // ---- Pan by dragging the background; also broadcast the cursor ------------
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-canvas-ui]")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = canvasRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      // Send the cursor in canvas coordinates, so other users see it in the right place.
      wsSend({
        type: "cursor_move",
        x: (e.clientX - rect.left - view.x) / view.zoom,
        y: (e.clientY - rect.top - view.y) / view.zoom,
      });
    }

    const p = pan.current;
    if (!p) return;
    const dx = e.clientX - p.px;
    const dy = e.clientY - p.py;
    if (!p.moved && Math.hypot(dx, dy) < 4) return;
    p.moved = true;
    setView((v) => ({ ...v, x: p.vx + dx, y: p.vy + dy }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    pan.current = null;
    if (p?.moved) justPanned.current = true;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleClick = () => {
    // A drag ends with a click event: ignore it so the selection is not cleared.
    if (justPanned.current) {
      justPanned.current = false;
      return;
    }
    clearSelection();
  };

  // ---- Keyboard ------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't react while the user is typing (for example in the chat box or a field).
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelection();
      }
    },
    [undo, redo, duplicateSelected, clearSelection, deleteSelection]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Other users' cursors arrive in canvas coordinates: convert them to screen position.
  const screenCursors = useMemo(() => {
    const out: Record<string, Cursor> = {};
    for (const [id, c] of Object.entries(cursors)) {
      out[id] = { ...c, x: c.x * view.zoom + view.x, y: c.y * view.zoom + view.y };
    }
    return out;
  }, [cursors, view]);

  const selectedShape = shapes.find((s) => s.id === selectedShapeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const editingShape = shapes.find((s) => s.id === editingShapeId);
  const containerWidth = canvasRef.current?.clientWidth ?? 800;

  // The grid follows pan and zoom, like a sheet of graph paper.
  const gridPx = settings.gridSize * view.zoom;
  const gridStyle =
    settings.grid && gridPx >= 6
      ? {
          backgroundImage:
            "linear-gradient(to right, var(--ghost-grid, #e5e7eb) 1px, transparent 1px), linear-gradient(to bottom, var(--ghost-grid, #e5e7eb) 1px, transparent 1px)",
          backgroundSize: `${gridPx}px ${gridPx}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }
      : undefined;

  return (
    <div className="flex h-full w-full flex-col">
      <MenuToolbar
        libraryOpen={libraryOpen}
        onToggleLibrary={() => setLibraryOpen((o) => !o)}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((o) => !o)}
        zoom={view.zoom}
        onZoomTo={zoomTo}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onFit={fitView}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        hasSelection={Boolean(selectedShapeId || selectedEdgeId)}
        hasShapeSelected={Boolean(selectedShape)}
        onDelete={deleteSelection}
        onDuplicate={duplicateSelected}
        settings={settings}
        onSettings={updateSettings}
        tableView={tableView}
        onTableView={setTableView}
        onClear={clearAll}
        onExportSpec={exportSpec}
        onExportJson={exportJson}
        onImportJson={importJson}
      />

      <div className="relative flex min-h-0 flex-1">
        {/* Shape library (docked on wide screens, a drawer on small ones) */}
        {libraryOpen && (
          <div className="absolute inset-y-0 left-0 z-30 shadow-xl md:static md:z-auto md:shadow-none">
            <ShapeLibrary onAdd={(type) => handleAddShape(type)} />
          </div>
        )}

        {/* The drawing area */}
        <div
          ref={canvasRef}
          className="relative min-w-0 flex-1 touch-none select-none overflow-hidden bg-slate-50"
          style={gridStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Hint shown while the canvas is empty */}
          {shapes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-center shadow-sm backdrop-blur">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg text-indigo-600">
                  ✦
                </div>
                <p className="text-sm font-semibold text-slate-800">Your canvas is empty</p>
                <p className="mt-1 text-xs text-slate-500">
                  Describe a system in the AI chat, or drag a shape in from the library on the left.
                  Double-click a card to edit it, and drag the arrow in its corner to resize it.
                </p>
              </div>
            </div>
          )}

          {connectingFrom && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
              Click the component you want to connect to · Esc to cancel
            </div>
          )}

          {/* Label bar for the selected arrow */}
          {selectedEdge && !connectingFrom && (
            <EdgeBar
              key={`edge-bar-${selectedEdge.id}`}
              label={selectedEdge.label ?? ""}
              onCommit={(label) => commitEdgeLabel(selectedEdge.id, label)}
              onDelete={() => removeEdge(selectedEdge.id)}
            />
          )}

          {/* Everything that zooms and pans together */}
          <div
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={1}
              height={1}
              style={{ overflow: "visible" }}
            >
              {edges.map((edge) => (
                <Edge
                  key={edge.id}
                  edge={edge}
                  shapes={shapes}
                  selected={edge.id === selectedEdgeId}
                  onSelect={() => {
                    setSelectedEdgeId(edge.id);
                    setSelectedShape(null);
                    setConnectingFrom(null);
                  }}
                  onDelete={() => removeEdge(edge.id)}
                />
              ))}
            </svg>

            {shapes.map((shape) => (
              <Shape
                key={shape.id}
                shape={shape}
                isSelected={shape.id === selectedShapeId}
                scale={view.zoom}
                onSelect={() => handleSelectShape(shape.id)}
                onMove={(x, y) => handleMoveShape(shape.id, x, y)}
                onEdit={() => setEditingShapeId(shape.id)}
                onResize={(w, h) => handleResizeShape(shape, w, h)}
              />
            ))}
          </div>

          {/* Actions for the selected component (drawn in screen space) */}
          {selectedShape && (
            <SelectionBar
              key={`bar-${selectedShape.id}`}
              shapeType={selectedShape.type}
              anchorX={(selectedShape.x + shapeWidth(selectedShape) / 2) * view.zoom + view.x}
              top={selectedShape.y * view.zoom + view.y}
              bottom={(selectedShape.y + shapeHeight(selectedShape)) * view.zoom + view.y}
              containerWidth={containerWidth}
              connecting={connectingFrom === selectedShape.id}
              onChangeType={(type) => handleChangeType(selectedShape.id, type)}
              onEdit={() => setEditingShapeId(selectedShape.id)}
              onDelete={() => removeShape(selectedShape.id)}
              onToggleConnect={() =>
                setConnectingFrom((cur) => (cur === selectedShape.id ? null : selectedShape.id))
              }
            />
          )}

          {/* Remote cursors */}
          <CursorOverlay cursors={screenCursors} currentUserId={userId} />

          {/* Hint */}
          <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-[11px] text-slate-500 shadow-sm backdrop-blur lg:block">
            Scroll to zoom · Drag the canvas to pan · Ctrl+Z to undo · Double-click a card to edit
          </div>
        </div>

        {/* Style and diagram settings */}
        {inspectorOpen && (
          <div className="absolute inset-y-0 right-0 z-30 shadow-xl xl:static xl:z-auto xl:shadow-none">
            <Inspector
              shape={selectedShape}
              settings={settings}
              onSettings={updateSettings}
              tableView={tableView}
              onTableView={setTableView}
              onShapeChange={(changes) => selectedShape && saveShape(selectedShape.id, changes)}
              onEditContent={() => selectedShape && setEditingShapeId(selectedShape.id)}
              onDuplicate={duplicateSelected}
              onDelete={() => selectedShape && removeShape(selectedShape.id)}
            />
          </div>
        )}
      </div>

      {/* Editor for a table's columns or a card's text */}
      {editingShape && (
        <ShapeEditor
          key={`editor-${editingShape.id}`}
          shape={editingShape}
          onSave={(changes) => saveShape(editingShape.id, changes)}
          onClose={() => setEditingShapeId(null)}
        />
      )}
    </div>
  );
}
