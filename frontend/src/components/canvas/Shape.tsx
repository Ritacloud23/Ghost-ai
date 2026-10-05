"use client";

import { useRef } from "react";
import type { Shape as ShapeData } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas";
import {
  ENTITY_HEADER_H,
  ENTITY_MAX_COLUMNS,
  ENTITY_ROW_H,
  SHAPE_META,
  clampHeight,
  clampWidth,
  shapeHeight,
  shapeWidth,
  withAlpha,
} from "@/lib/shapeConfig";
import ShapeGlyph from "./ShapeGlyph";

interface ShapeProps {
  shape: ShapeData;
  isSelected: boolean;
  /** Current canvas zoom, so dragging follows the mouse at any zoom level. */
  scale: number;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  /** Called on double-click, to open the editor. */
  onEdit?: () => void;
  /** Called while the resize arrow is dragged. */
  onResize?: (w: number, h: number) => void;
}

function TableIcon({ color }: { color: string }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color }}>
      <svg
        viewBox="0 0 20 20"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="14" height="12" rx="2" />
        <path d="M3 9h14M8 9v7" />
      </svg>
    </span>
  );
}

/** A database table as a compact card: icon, bold name, column count, key columns. */
function EntityCard({ shape, isSelected }: { shape: ShapeData; isSelected: boolean }) {
  const color = shape.color || SHAPE_META.entity.color;
  const columns = shape.columns ?? [];
  const tint = withAlpha(color, 0.13);

  const keyColumns = columns
    .filter((c) => c.key)
    .map((c) => `${(c.key as string).toUpperCase()} ${c.name}`);
  const summary =
    keyColumns.length > 0
      ? keyColumns.join(" · ")
      : columns
          .slice(0, 3)
          .map((c) => c.name)
          .join(", ") || "No columns yet";

  return (
    <div
      className={`flex h-full w-full flex-col justify-center rounded-2xl border px-4 transition-shadow ${
        isSelected ? "shadow-xl ring-2 ring-blue-500" : "shadow-sm hover:shadow-md"
      }`}
      style={{
        backgroundColor: "var(--ghost-card, #ffffff)",
        backgroundImage: `linear-gradient(${tint}, ${tint})`,
        borderColor: withAlpha(color, 0.28),
      }}
    >
      <div className="flex items-center gap-2">
        <TableIcon color={color} />
        <p className="min-w-0 truncate text-[15px] font-bold leading-tight text-slate-900">
          {shape.label}
        </p>
      </div>
      <p className="mt-0.5 truncate font-mono text-[11px] leading-tight text-slate-500">
        {columns.length} {columns.length === 1 ? "column" : "columns"}
      </p>
      <p className="mt-1 truncate text-[12px] leading-tight text-slate-700">{summary}</p>
    </div>
  );
}

/** A database table as a full table: a soft header, then one row per column. */
function EntityBody({ shape, isSelected }: { shape: ShapeData; isSelected: boolean }) {
  const color = shape.color || SHAPE_META.entity.color;
  const columns = shape.columns ?? [];
  const shown = columns.slice(0, ENTITY_MAX_COLUMNS);
  const extra = columns.length - shown.length;
  const tint = withAlpha(color, 0.13);

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white ${
        isSelected ? "shadow-xl ring-2 ring-blue-500" : "shadow-sm hover:shadow-md"
      }`}
      style={{ borderColor: withAlpha(color, 0.3) }}
    >
      <div
        className="flex shrink-0 items-center gap-2 px-3"
        style={{
          height: ENTITY_HEADER_H,
          backgroundColor: "var(--ghost-card, #ffffff)",
          backgroundImage: `linear-gradient(${tint}, ${tint})`,
          borderBottom: `1px solid ${withAlpha(color, 0.2)}`,
        }}
      >
        <TableIcon color={color} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-slate-900">
          {shape.label}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-slate-500">
          {columns.length} {columns.length === 1 ? "col" : "cols"}
        </span>
      </div>

      {shown.length === 0 ? (
        <div
          className="flex items-center px-3 text-[12px] italic text-slate-400"
          style={{ height: ENTITY_ROW_H }}
        >
          No columns yet. Double-click to edit.
        </div>
      ) : (
        shown.map((col, i) => (
          <div
            key={`${col.name}-${i}`}
            className={`flex shrink-0 items-center gap-2 bg-white px-3 text-[12px] ${
              i > 0 ? "border-t border-slate-100" : ""
            }`}
            style={{ height: ENTITY_ROW_H }}
          >
            <span
              className={`w-6 shrink-0 rounded text-center text-[9px] font-bold leading-4 ${
                col.key === "pk"
                  ? "bg-amber-100 text-amber-700"
                  : col.key === "fk"
                  ? "bg-blue-100 text-blue-700"
                  : ""
              }`}
            >
              {col.key ? col.key.toUpperCase() : ""}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{col.name}</span>
            <span className="shrink-0 font-mono text-[11px] text-slate-500">{col.type}</span>
          </div>
        ))
      )}

      {extra > 0 && (
        <div
          className="flex shrink-0 items-center border-t border-slate-100 bg-white px-3 text-[11px] text-slate-400"
          style={{ height: ENTITY_ROW_H }}
        >
          +{extra} more
        </div>
      )}
    </div>
  );
}

/** A component card: small flat icon beside a bold title, a monospace subtitle, a short description. */
function CardBody({ shape, isSelected }: { shape: ShapeData; isSelected: boolean }) {
  const meta = SHAPE_META[shape.type] ?? SHAPE_META.service;
  const accent = shape.color || meta.color;
  const tint = withAlpha(accent, 0.13);

  return (
    <div
      className={`flex h-full w-full flex-col justify-center rounded-2xl border px-4 transition-shadow ${
        isSelected ? "shadow-xl ring-2 ring-blue-500" : "shadow-sm hover:shadow-md"
      }`}
      style={{
        backgroundColor: "var(--ghost-card, #ffffff)",
        backgroundImage: `linear-gradient(${tint}, ${tint})`,
        borderColor: withAlpha(accent, 0.28),
      }}
    >
      <div className="flex items-center gap-2">
        <span className="h-4 w-6 shrink-0">
          <ShapeGlyph type={shape.type} color={accent} />
        </span>
        <p className="min-w-0 truncate text-[15px] font-bold leading-tight text-slate-900">
          {shape.label}
        </p>
      </div>
      <p className="mt-0.5 truncate font-mono text-[11px] leading-tight text-slate-500">
        {shape.tech || meta.label}
      </p>
      {shape.description && (
        <p className="mt-1 truncate text-[12px] leading-tight text-slate-700">
          {shape.description}
        </p>
      )}
    </div>
  );
}

export default function Shape({
  shape,
  isSelected,
  scale,
  onSelect,
  onMove,
  onEdit,
  onResize,
}: ShapeProps) {
  const tableView = useCanvasStore((s) => s.tableView);
  const drag = useRef<{ px: number; py: number; sx: number; sy: number } | null>(null);
  const resize = useRef<{ px: number; py: number; sw: number; sh: number } | null>(null);

  const fullTable = shape.type === "entity" && tableView === "columns";

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, sx: shape.x, sy: shape.y };
    onSelect();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const x = d.sx + (e.clientX - d.px) / scale;
    const y = d.sy + (e.clientY - d.py) / scale;
    if (x !== shape.x || y !== shape.y) onMove(x, y);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // ---- Resize arrow ---------------------------------------------------------
  const handleResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resize.current = {
      px: e.clientX,
      py: e.clientY,
      sw: shapeWidth(shape),
      sh: shapeHeight(shape),
    };
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resize.current;
    if (!r) return;
    const w = clampWidth(shape.type, r.sw + (e.clientX - r.px) / scale);
    const h = clampHeight(r.sh + (e.clientY - r.py) / scale);
    onResize?.(Math.round(w), Math.round(h));
  };

  const endResize = (e: React.PointerEvent<HTMLDivElement>) => {
    resize.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit?.();
      }}
      className={`absolute cursor-grab touch-none select-none transition-transform duration-150 hover:-translate-y-0.5 active:cursor-grabbing ${
        isSelected ? "z-10" : ""
      }`}
      style={{
        left: shape.x,
        top: shape.y,
        width: shapeWidth(shape),
        height: shapeHeight(shape),
        animation: "ghost-pop 0.25s ease-out",
      }}
    >
      {fullTable ? (
        <EntityBody shape={shape} isSelected={isSelected} />
      ) : shape.type === "entity" ? (
        <EntityCard shape={shape} isSelected={isSelected} />
      ) : (
        <CardBody shape={shape} isSelected={isSelected} />
      )}

      {/* The arrow in the corner: drag it to make the card bigger or smaller */}
      {isSelected && onResize && (
        <div
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          title={fullTable ? "Drag to change the width" : "Drag to resize"}
          className="absolute -bottom-3 -right-3 z-20 flex h-6 w-6 cursor-nwse-resize touch-none items-center justify-center rounded-full border border-blue-500 bg-white text-blue-600 shadow-md hover:bg-blue-50"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 5l10 10M15 9v6H9" />
          </svg>
        </div>
      )}
    </div>
  );
}
