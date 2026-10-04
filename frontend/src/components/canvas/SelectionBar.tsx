"use client";

import { useEffect, useRef, useState } from "react";
import type { ShapeType } from "@/lib/types";
import { SHAPE_GROUPS, SHAPE_META } from "@/lib/shapeConfig";
import TypeIcon from "./TypeIcon";

interface SelectionBarProps {
  shapeType: ShapeType;
  /** Horizontal center of the selected card, in screen pixels. */
  anchorX: number;
  /** Top and bottom edge of the selected card, in screen pixels. */
  top: number;
  bottom: number;
  /** Width of the canvas, so the bar never goes off screen. */
  containerWidth: number;
  connecting: boolean;
  onChangeType: (type: ShapeType) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleConnect: () => void;
}

const ALL_TYPES = SHAPE_GROUPS.flatMap((g) => g.types);

export default function SelectionBar({
  shapeType,
  anchorX,
  top,
  bottom,
  containerWidth,
  connecting,
  onChangeType,
  onEdit,
  onDelete,
  onToggleConnect,
}: SelectionBarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the type picker when clicking outside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Above the card, or below it when the card is near the top edge.
  const above = top >= 70;
  const barTop = above ? top - 54 : bottom + 12;
  const half = 190;
  const left = Math.min(Math.max(anchorX, half), Math.max(half, containerWidth - half));

  return (
    <div
      ref={ref}
      data-canvas-ui
      className="absolute z-30"
      style={{ left, top: barTop, transform: "translateX(-50%)" }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
        <button
          type="button"
          title={shapeType === "entity" ? "Edit the table name and columns" : "Edit title, technology and description"}
          onClick={() => {
            setOpen(false);
            onEdit();
          }}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Edit
        </button>

        <button
          type="button"
          title="Change this component to another type"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Change type ▾
        </button>

        <button
          type="button"
          title="Draw an arrow from this component to another"
          onClick={() => {
            setOpen(false);
            onToggleConnect();
          }}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
            connecting ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          {connecting ? "Cancel" : "Connect →"}
        </button>

        <button
          type="button"
          title="Delete this component"
          onClick={onDelete}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>

      {open && (
        <div className="absolute left-1/2 top-full z-40 mt-2 grid w-72 -translate-x-1/2 grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onChangeType(type);
                setOpen(false);
              }}
              className={`flex flex-col items-center gap-1 rounded-lg p-1.5 text-[11px] text-slate-700 hover:bg-slate-100 ${
                type === shapeType ? "bg-blue-50 ring-1 ring-blue-300" : ""
              }`}
            >
              <span className="block h-6 w-11">
                <TypeIcon type={type} />
              </span>
              {SHAPE_META[type].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
