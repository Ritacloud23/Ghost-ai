"use client";

import { useEffect, useState } from "react";
import type { Shape } from "@/lib/types";
import type { DiagramSettings, LineStyle, TableView } from "@/store/canvas";
import {
  SHAPE_META,
  clampHeight,
  clampWidth,
  isColumnsTable,
  shapeHeight,
  shapeWidth,
} from "@/lib/shapeConfig";
import TypeIcon from "./TypeIcon";

const SWATCHES = [
  "#2B6CA3",
  "#2F7D5B",
  "#0F766E",
  "#6D28D9",
  "#BE185D",
  "#B45309",
  "#B91C1C",
  "#475569",
];

interface InspectorProps {
  shape: Shape | undefined;
  settings: DiagramSettings;
  onSettings: (partial: Partial<DiagramSettings>) => void;
  tableView: TableView;
  onTableView: (view: TableView) => void;
  onShapeChange: (changes: Partial<Shape>) => void;
  onEditContent: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm normal-case tracking-normal text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50";

const labelClass = "block text-[10px] font-semibold uppercase tracking-wider text-slate-400";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-5 border-t border-slate-100 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 first:mt-0 first:border-0 first:pt-0">
      {children}
    </p>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
      />
      {children}
    </label>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
            value === option.value
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        type="number"
        value={Math.round(value)}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === "") return;
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onCommit(n);
        }}
        className={inputClass}
      />
    </label>
  );
}

export default function Inspector({
  shape,
  settings,
  onSettings,
  tableView,
  onTableView,
  onShapeChange,
  onEditContent,
  onDuplicate,
  onDelete,
}: InspectorProps) {
  const [tab, setTab] = useState<"diagram" | "style">("diagram");

  // Selecting a card shows its style; the Diagram tab stays one click away.
  const selectedId = shape?.id;
  useEffect(() => {
    if (selectedId) setTab("style");
  }, [selectedId]);

  const tabClass = (active: boolean) =>
    `flex-1 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "border-indigo-600 text-slate-900"
        : "border-transparent text-slate-500 hover:text-slate-800"
    }`;

  const meta = shape ? SHAPE_META[shape.type] ?? SHAPE_META.service : null;

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex border-b border-slate-200">
        <button type="button" onClick={() => setTab("diagram")} className={tabClass(tab === "diagram")}>
          Diagram
        </button>
        <button type="button" onClick={() => setTab("style")} className={tabClass(tab === "style")}>
          Style
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "diagram" ? (
          <>
            <SectionTitle>View</SectionTitle>
            <Checkbox checked={settings.grid} onChange={(grid) => onSettings({ grid })}>
              Grid
            </Checkbox>
            <label className={`${labelClass} mt-1`}>
              Grid size
              <input
                type="number"
                min={5}
                max={100}
                step={5}
                value={settings.gridSize}
                disabled={!settings.grid && !settings.snap}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && e.target.value !== "") onSettings({ gridSize: n });
                }}
                className={inputClass}
              />
            </label>
            <Checkbox checked={settings.snap} onChange={(snap) => onSettings({ snap })}>
              Snap to grid
            </Checkbox>

            <SectionTitle>Connections</SectionTitle>
            <Segmented<LineStyle>
              value={settings.lineStyle}
              onChange={(lineStyle) => onSettings({ lineStyle })}
              options={[
                { value: "orthogonal", label: "Right angle" },
                { value: "straight", label: "Straight" },
                { value: "curved", label: "Curved" },
              ]}
            />
            <div className="mt-2">
              <Checkbox checked={settings.arrowheads} onChange={(arrowheads) => onSettings({ arrowheads })}>
                Connection arrows
              </Checkbox>
              <Checkbox checked={settings.showLabels} onChange={(showLabels) => onSettings({ showLabels })}>
                Connection labels
              </Checkbox>
            </div>

            <SectionTitle>Tables</SectionTitle>
            <Segmented<TableView>
              value={tableView}
              onChange={onTableView}
              options={[
                { value: "card", label: "Cards" },
                { value: "columns", label: "Columns" },
              ]}
            />
            <p className="mt-2 text-[11px] text-slate-500">
              These settings are saved in this browser, not in the diagram.
            </p>
          </>
        ) : !shape || !meta ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-slate-700">Nothing selected</p>
            <p className="mt-1 text-xs text-slate-500">
              Click a card to change its text, size, position and color.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <span className="block h-6 w-9 shrink-0">
                <TypeIcon type={shape.type} />
              </span>
              <span className="text-sm font-semibold text-slate-900">{meta.label}</span>
            </div>

            <SectionTitle>Text</SectionTitle>
            <label className={labelClass}>
              {shape.type === "entity" ? "Table name" : "Title"}
              <input
                value={shape.label}
                onChange={(e) => onShapeChange({ label: e.target.value })}
                className={inputClass}
              />
            </label>

            {shape.type === "entity" ? (
              <button
                type="button"
                onClick={onEditContent}
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit columns...
              </button>
            ) : (
              <>
                <label className={`${labelClass} mt-3`}>
                  Technology
                  <input
                    value={shape.tech ?? ""}
                    onChange={(e) => onShapeChange({ tech: e.target.value })}
                    placeholder="for example PostgreSQL"
                    className={inputClass}
                  />
                </label>
                <label className={`${labelClass} mt-3`}>
                  Description
                  <input
                    value={shape.description ?? ""}
                    onChange={(e) => onShapeChange({ description: e.target.value })}
                    placeholder="One short line"
                    className={inputClass}
                  />
                </label>
              </>
            )}

            <SectionTitle>Arrange</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Width"
                value={shapeWidth(shape)}
                onCommit={(n) => onShapeChange({ w: clampWidth(shape.type, n) })}
              />
              <NumberField
                label="Height"
                value={shapeHeight(shape)}
                disabled={isColumnsTable(shape)}
                onCommit={(n) => onShapeChange({ h: clampHeight(n) })}
              />
              <NumberField label="X" value={shape.x} onCommit={(n) => onShapeChange({ x: n })} />
              <NumberField label="Y" value={shape.y} onCommit={(n) => onShapeChange({ y: n })} />
            </div>

            <SectionTitle>Color</SectionTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                title="Default color"
                onClick={() => onShapeChange({ color: "" })}
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] text-slate-500 ${
                  !shape.color ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-300"
                }`}
              >
                Auto
              </button>
              {SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  aria-label={`Color ${color}`}
                  onClick={() => onShapeChange({ color })}
                  className={`h-7 w-7 rounded-full border ${
                    shape.color?.toLowerCase() === color.toLowerCase()
                      ? "border-indigo-500 ring-2 ring-indigo-200"
                      : "border-white/60"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <label className={`${labelClass} mt-3 flex items-center gap-2`}>
              Custom
              <input
                type="color"
                value={shape.color || meta.color}
                onChange={(e) => onShapeChange({ color: e.target.value })}
                className="h-7 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
              />
            </label>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={onDuplicate}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
