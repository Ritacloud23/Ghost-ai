"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ShapeType } from "@/lib/types";
import { SHAPE_GROUPS, SHAPE_META } from "@/lib/shapeConfig";
import TypeIcon from "./TypeIcon";

/** The drag-and-drop data type used when a shape is dragged onto the canvas. */
export const DRAG_MIME = "application/x-ghost-shape";

interface ShapeLibraryProps {
  onAdd: (type: ShapeType) => void;
}

export default function ShapeLibrary({ onAdd }: ShapeLibraryProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  // Pressing "/" jumps to the search box (unless you are already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      SHAPE_GROUPS.map((group) => ({
        ...group,
        types: group.types.filter(
          (type) =>
            !q ||
            type.includes(q) ||
            SHAPE_META[type].label.toLowerCase().includes(q) ||
            SHAPE_META[type].description.toLowerCase().includes(q)
        ),
      })).filter((group) => group.types.length > 0),
    [q]
  );

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <svg
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="5" />
            <path d="M13 13l4 4" />
          </svg>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Type / to search"
            className="w-full rounded-full border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      {/* Shapes */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {groups.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-slate-500">No shapes match &quot;{query}&quot;.</p>
        )}

        {groups.map((group) => {
          const isOpen = q ? true : !collapsed[group.name];
          return (
            <div key={group.name} className="mb-2">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [group.name]: !c[group.name] }))}
                className="flex w-full items-center gap-1.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800"
              >
                <svg
                  viewBox="0 0 20 20"
                  className={`h-3 w-3 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 8l5 5 5-5" />
                </svg>
                {group.name}
              </button>

              {isOpen && (
                <div className="grid grid-cols-3 gap-1.5">
                  {group.types.map((type) => (
                    <button
                      key={type}
                      type="button"
                      draggable
                      title={`${SHAPE_META[type].label}: ${SHAPE_META[type].description}`}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_MIME, type);
                        e.dataTransfer.setData("text/plain", type);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => onAdd(type)}
                      className="flex h-[58px] cursor-grab flex-col items-center justify-center gap-1 rounded-lg border border-transparent p-1 text-slate-700 transition-colors hover:border-slate-200 hover:bg-slate-50 active:cursor-grabbing"
                    >
                      <span className="block h-6 w-9">
                        <TypeIcon type={type} />
                      </span>
                      <span className="w-full truncate text-center text-[9px] leading-none text-slate-500">
                        {SHAPE_META[type].label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="border-t border-slate-100 px-3 py-2 text-[10px] leading-snug text-slate-400">
        Click a shape to add it, or drag it onto the canvas.
      </p>
    </div>
  );
}
