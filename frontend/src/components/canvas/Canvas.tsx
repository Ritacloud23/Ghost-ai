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
import Shape from "./Shape";
import Edge from "./Edge";
import CursorOverlay from "./CursorOverlay";
import Toolbar from "./Toolbar";
import SelectionBar from "./SelectionBar";
import ShapeEditor from "./ShapeEditor";
import EdgeBar from "./EdgeBar";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.6;

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

interface CanvasProps {
  projectId: string;
  userId: string;
  onConnect: (projectId: string) => void;
  wsSend: (msg: { type: string; [key: string]: unknown }) => void;
}

export default function Canvas({ projectId, userId, onConnect, wsSend }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    shapes,
    edges,
    cursors,
    selectedShapeId,
    addShape,
    updateShape,
    deleteShape,
    addEdge,
    updateEdge,
    deleteEdge,
    setSelectedShape,
  } = useCanvasStore();

  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  // Which shape the user is drawing an arrow from (null = not drawing an arrow)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);

  const pan = useRef<{ px: number; py: number; vx: number; vy: number; moved: boolean } | null>(
    null
  );
  const justPanned = useRef(false);

  useEffect(() => {
    onConnect(projectId);
  }, [projectId, onConnect]);

  // ---- Zoom with the mouse wheel -------------------------------------------
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Let panels (like the Components list) scroll instead of zooming the canvas.
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

  // When a whole design appears at once (from the AI or a load), fit it on screen.
  const prevCount = useRef(0);
  useEffect(() => {
    const prev = prevCount.current;
    prevCount.current = shapes.length;
    if (shapes.length - prev >= 2) fitView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes.length]);

  // ---- Shape and arrow actions ---------------------------------------------
  const handleAddShape = useCallback(
    (type: ShapeType) => {
      const el = canvasRef.current;
      const cw = el?.clientWidth ?? 800;
      const ch = el?.clientHeight ?? 600;
      // Drop the new shape near the middle of what the user is looking at.
      const cx = (cw / 2 - view.x) / view.zoom;
      const cy = (ch / 2 - view.y) / view.zoom;
      const columns = type === "entity" ? defaultColumns() : undefined;
      const w = shapeWidth({ type });
      const h = shapeHeight({ type, columns });
      const id = crypto.randomUUID();
      const shape: ShapeData = {
        id,
        type,
        x: cx - w / 2 + (Math.random() - 0.5) * 160,
        y: cy - h / 2 + (Math.random() - 0.5) * 120,
        label: defaultLabel(type),
        ...(columns ? { columns } : {}),
      };
      addShape(shape);
      wsSend({ type: "shape_add", shape });
      setSelectedShape(id);
      setSelectedEdgeId(null);
    },
    [view, addShape, wsSend, setSelectedShape]
  );

  const handleMoveShape = useCallback(
    (id: string, x: number, y: number) => {
      updateShape(id, { x, y });
      wsSend({ type: "shape_update", shape_id: id, changes: { x, y } });
    },
    [updateShape, wsSend]
  );

  const saveShape = useCallback(
    (id: string, changes: Partial<ShapeData>) => {
      updateShape(id, changes);
      wsSend({ type: "shape_update", shape_id: id, changes });
    },
    [updateShape, wsSend]
  );

  // Dragging the resize arrow. Tables only change width: their height follows the columns.
  const handleResizeShape = useCallback(
    (shape: ShapeData, w: number, h: number) => {
      saveShape(shape.id, shape.type === "entity" ? { w } : { w, h });
    },
    [saveShape]
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
    if (!window.confirm("Erase everything on this canvas?")) return;
    shapes.forEach((s) => {
      deleteShape(s.id);
      wsSend({ type: "shape_delete", shape_id: s.id });
    });
    clearSelection();
  }, [shapes, deleteShape, wsSend, clearSelection]);

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
      // Don't react while the user is typing (for example in the chat box or the editor).
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

      if (e.key === "Escape") {
        clearSelection();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEdgeId) removeEdge(selectedEdgeId);
        else if (selectedShapeId) removeShape(selectedShapeId);
      }
    },
    [selectedEdgeId, selectedShapeId, removeEdge, removeShape, clearSelection]
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
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-slate-50"
      style={{
        backgroundImage: "radial-gradient(var(--ghost-dot, #cbd5e1) 1px, transparent 1px)",
        backgroundSize: `${22 * view.zoom}px ${22 * view.zoom}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
    >
      <Toolbar onAddShape={handleAddShape} />

      {/* Hint shown while the canvas is empty */}
      {shapes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-center shadow-sm backdrop-blur">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-lg text-indigo-600">
              ✦
            </div>
            <p className="text-sm font-semibold text-slate-800">Your canvas is empty</p>
            <p className="mt-1 text-xs text-slate-500">
              Describe a system in the AI chat, or pick a component from the panel to draw one
              yourself. Use &ldquo;Table&rdquo; to design a database. Double-click any card to
              edit it, and drag the arrow in its corner to resize it.
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

      {/* Editor for a table's columns or a card's text */}
      {editingShape && (
        <ShapeEditor
          key={`editor-${editingShape.id}`}
          shape={editingShape}
          onSave={(changes) => saveShape(editingShape.id, changes)}
          onClose={() => setEditingShapeId(null)}
        />
      )}

      {/* Erase canvas */}
      <button
        type="button"
        data-canvas-ui
        onPointerDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          clearAll();
        }}
        className="absolute bottom-4 left-4 z-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-md transition-colors hover:bg-slate-50"
      >
        Erase canvas
      </button>

      {/* Hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-[11px] text-slate-500 shadow-sm backdrop-blur md:block">
        Scroll to zoom · Drag the canvas to pan · Drag a card&apos;s corner arrow to resize
      </div>

      {/* Zoom controls */}
      <div
        data-canvas-ui
        className="absolute bottom-20 right-4 z-20 flex flex-col items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md md:bottom-4"
        onPointerDown={stop}
        onClick={stop}
      >
        <button
          type="button"
          onClick={() => zoomBy(1.2)}
          aria-label="Zoom in"
          className="h-9 w-9 text-lg text-slate-700 hover:bg-slate-100"
        >
          +
        </button>
        <span className="w-9 border-y border-slate-100 py-1 text-center text-[10px] text-slate-500">
          {Math.round(view.zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.2)}
          aria-label="Zoom out"
          className="h-9 w-9 text-lg text-slate-700 hover:bg-slate-100"
        >
          −
        </button>
        <button
          type="button"
          onClick={fitView}
          aria-label="Fit everything on screen"
          title="Fit to screen"
          className="flex h-9 w-9 items-center justify-center border-t border-slate-100 text-slate-700 hover:bg-slate-100"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
