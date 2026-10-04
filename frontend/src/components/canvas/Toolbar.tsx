"use client";

import { useEffect, useState } from "react";
import type { ShapeType } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas";
import { SHAPE_GROUPS, SHAPE_META } from "@/lib/shapeConfig";
import TypeIcon from "./TypeIcon";

interface ToolbarProps {
  onAddShape: (type: ShapeType) => void;
}

export default function Toolbar({ onAddShape }: ToolbarProps) {
  const [open, setOpen] = useState(false);
  const tableView = useCanvasStore((s) => s.tableView);
  const setTableView = useCanvasStore((s) => s.setTableView);

  // Start expanded on large screens, collapsed on phones.
  useEffect(() => {
    if (window.innerWidth >= 1024) setOpen(true);
  }, []);

  const viewButton = (value: "card" | "columns", label: string) => (
    <button
      type="button"
      onClick={() => setTableView(value)}
      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
        tableView === value
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      data-canvas-ui
      className="absolute left-4 top-4 z-20 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Components
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div className="max-h-[55vh] overflow-y-auto border-t border-slate-100 p-2">
          {SHAPE_GROUPS.map((group) => (
            <div key={group.name} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group.name}
              </p>
              {group.types.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAddShape(type)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-100"
                >
                  <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-50 p-1">
                    <TypeIcon type={type} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {SHAPE_META[type].label}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {SHAPE_META[type].description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}

          {/* How database tables are drawn */}
          <div className="mt-2 border-t border-slate-100 px-2 pb-2 pt-3">
            <p className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Table style
            </p>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {viewButton("card", "Cards")}
              {viewButton("columns", "Columns")}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Cards are compact. Columns shows every column with its type.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
