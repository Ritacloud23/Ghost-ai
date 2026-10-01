"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCanvasStore } from "@/store/canvas";
import { ShapeType } from "@/lib/types";
import Shape from "./Shape";
import Edge from "./Edge";
import CursorOverlay from "./CursorOverlay";
import Toolbar from "./Toolbar";

interface CanvasProps {
  projectId: string;
  userId: string;
  onConnect: (projectId: string) => void;
  wsSend: (msg: { type: string; [key: string]: unknown }) => void;
}

export default function Canvas({ projectId, userId, onConnect, wsSend }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { shapes, edges, cursors, selectedShapeId, addShape, updateShape, deleteShape, setSelectedShape, loadDesign } =
    useCanvasStore();

  useEffect(() => {
    onConnect(projectId);
  }, [projectId, onConnect]);

  const handleAddShape = useCallback(
    (type: ShapeType) => {
      const id = crypto.randomUUID();
      const shape = {
        id,
        type,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        label: `New ${type}`,
      };
      addShape(shape);
      wsSend({ type: "shape_add", shape });
    },
    [addShape, wsSend]
  );

  const handleMoveShape = useCallback(
    (id: string, x: number, y: number) => {
      updateShape(id, { x, y });
      wsSend({ type: "shape_update", shape_id: id, changes: { x, y } });
    },
    [updateShape, wsSend]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      wsSend({ type: "cursor_move", x, y });
    },
    [wsSend]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedShapeId) {
        deleteShape(selectedShapeId);
        wsSend({ type: "shape_delete", shape_id: selectedShapeId });
      }
    },
    [selectedShapeId, deleteShape, wsSend]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full overflow-hidden bg-gray-50"
      onMouseMove={handleMouseMove}
      onClick={() => setSelectedShape(null)}
    >
      <Toolbar onAddShape={handleAddShape} />

      {/* Edges */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {edges.map((edge) => (
          <Edge key={edge.id} edge={edge} shapes={shapes} />
        ))}
      </svg>

      {/* Shapes */}
      {shapes.map((shape) => (
        <Shape
          key={shape.id}
          shape={shape}
          isSelected={shape.id === selectedShapeId}
          onSelect={() => setSelectedShape(shape.id)}
          onMove={(x, y) => handleMoveShape(shape.id, x, y)}
        />
      ))}

      {/* Remote cursors */}
      <CursorOverlay cursors={cursors} currentUserId={userId} />
    </div>
  );
}
