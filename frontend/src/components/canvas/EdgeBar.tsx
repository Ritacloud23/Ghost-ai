"use client";

import { useState } from "react";

interface EdgeBarProps {
  label: string;
  onCommit: (label: string) => void;
  onDelete: () => void;
}

const PRESETS = ["1:1", "1:N", "N:M", "calls", "reads", "writes"];

export default function EdgeBar({ label, onCommit, onDelete }: EdgeBarProps) {
  const [value, setValue] = useState(label);

  return (
    <div
      data-canvas-ui
      className="absolute left-1/2 top-4 z-30 flex max-w-[95%] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onCommit(value.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Arrow label"
        maxLength={20}
        className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />

      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => {
            setValue(preset);
            onCommit(preset);
          }}
          className={`rounded-lg px-2 py-1 font-mono text-[11px] ${
            value === preset
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {preset}
        </button>
      ))}

      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Delete arrow
      </button>
    </div>
  );
}
