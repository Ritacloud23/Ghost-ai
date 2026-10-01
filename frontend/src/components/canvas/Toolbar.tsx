"use client";

import { ShapeType } from "@/lib/types";

const SHAPE_PALETTE: { type: ShapeType; label: string; icon: string }[] = [
  { type: "client", label: "Client", icon: "CLI" },
  { type: "gateway", label: "Gateway", icon: "GW" },
  { type: "service", label: "Service", icon: "SVC" },
  { type: "database", label: "Database", icon: "DB" },
  { type: "queue", label: "Queue", icon: "Q" },
  { type: "cache", label: "Cache", icon: "CACHE" },
];

interface ToolbarProps {
  onAddShape: (type: ShapeType) => void;
}

export default function Toolbar({ onAddShape }: ToolbarProps) {
  return (
    <div className="absolute left-4 top-4 z-40 flex flex-col gap-2 rounded-xl bg-white p-3 shadow-lg">
      <span className="text-xs font-semibold text-gray-500 uppercase">Shapes</span>
      {SHAPE_PALETTE.map((item) => (
        <button
          key={item.type}
          onClick={() => onAddShape(item.type)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
        >
          <span className="flex h-6 w-8 items-center justify-center rounded bg-gray-100 text-[10px] font-bold text-gray-600">
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
