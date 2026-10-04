"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { Shape, ShapeColumn } from "@/lib/types";

interface ShapeEditorProps {
  shape: Shape;
  onSave: (changes: Partial<Shape>) => void;
  onClose: () => void;
}

const COLUMN_TYPES = [
  "uuid",
  "int",
  "bigint",
  "text",
  "varchar(255)",
  "boolean",
  "timestamp",
  "date",
  "json",
  "float",
  "decimal",
];
const MAX_COLUMNS = 12;

const inputClass =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export default function ShapeEditor({ shape, onSave, onClose }: ShapeEditorProps) {
  const isEntity = shape.type === "entity";
  const [label, setLabel] = useState(shape.label);
  const [tech, setTech] = useState(shape.tech ?? "");
  const [description, setDescription] = useState(shape.description ?? "");
  const [columns, setColumns] = useState<ShapeColumn[]>(shape.columns ?? []);

  const updateColumn = (index: number, patch: Partial<ShapeColumn>) =>
    setColumns((cols) => cols.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const addColumn = () =>
    setColumns((cols) => (cols.length >= MAX_COLUMNS ? cols : [...cols, { name: "", type: "text" }]));

  const removeColumn = (index: number) =>
    setColumns((cols) => cols.filter((_, i) => i !== index));

  const save = () => {
    const changes: Partial<Shape> = { label: label.trim() || shape.label };
    if (isEntity) {
      changes.columns = columns
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          type: c.type.trim() || "text",
          ...(c.key ? { key: c.key } : {}),
        }));
    } else {
      // Empty text (not undefined) so the change also reaches other users.
      changes.tech = tech.trim();
      changes.description = description.trim();
    }
    onSave(changes);
    onClose();
  };

  return createPortal(
    <div
      data-canvas-ui
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-base font-semibold text-slate-900">
          {isEntity ? "Edit table" : "Edit component"}
        </h2>

        <label className="mt-4 block text-xs font-medium text-slate-600">
          {isEntity ? "Table name" : "Title"}
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>

        {isEntity ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Columns</span>
              <span className="text-[11px] text-slate-400">
                {columns.length} of {MAX_COLUMNS}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_1fr_72px_32px] gap-2 px-0.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Name</span>
              <span>Type</span>
              <span>Key</span>
              <span />
            </div>

            <div className="space-y-2">
              {columns.map((col, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_72px_32px] gap-2">
                  <input
                    value={col.name}
                    onChange={(e) => updateColumn(i, { name: e.target.value })}
                    placeholder="column_name"
                    className={inputClass}
                  />
                  <input
                    value={col.type}
                    onChange={(e) => updateColumn(i, { type: e.target.value })}
                    list="ghost-column-types"
                    placeholder="type"
                    className={inputClass}
                  />
                  <select
                    value={col.key ?? ""}
                    onChange={(e) =>
                      updateColumn(i, {
                        key: (e.target.value || undefined) as ShapeColumn["key"],
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">–</option>
                    <option value="pk">PK</option>
                    <option value="fk">FK</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeColumn(i)}
                    aria-label="Remove column"
                    className="rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <datalist id="ghost-column-types">
              {COLUMN_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>

            <button
              type="button"
              onClick={addColumn}
              disabled={columns.length >= MAX_COLUMNS}
              className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40"
            >
              + Add column
            </button>
          </div>
        ) : (
          <>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              Technology
              <input
                value={tech}
                onChange={(e) => setTech(e.target.value)}
                placeholder="for example PostgreSQL, Node.js, Redis"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              Description
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One short line"
                className={`${inputClass} mt-1`}
              />
            </label>
          </>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-110"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
