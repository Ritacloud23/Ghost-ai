"use client";

import { Shape as ShapeType } from "@/lib/types";

const SHAPE_COLORS: Record<string, string> = {
  database: "#3B82F6",
  service: "#10B981",
  queue: "#F59E0B",
  client: "#8B5CF6",
  gateway: "#EF4444",
  cache: "#06B6D4",
};

const SHAPE_ICONS: Record<string, string> = {
  database: "DB",
  service: "SVC",
  queue: "Q",
  client: "CLI",
  gateway: "GW",
  cache: "CACHE",
};

interface ShapeProps {
  shape: ShapeType;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}

export default function Shape({ shape, isSelected, onSelect, onMove }: ShapeProps) {
  const color = SHAPE_COLORS[shape.type] || "#6B7280";
  const icon = SHAPE_ICONS[shape.type] || "?";

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();

    const startX = e.clientX - shape.x;
    const startY = e.clientY - shape.y;

    const handleMouseMove = (ev: MouseEvent) => {
      onMove(ev.clientX - startX, ev.clientY - startY);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`absolute flex h-16 w-24 cursor-move flex-col items-center justify-center rounded-lg border-2 text-xs font-bold text-white shadow-md transition-shadow ${
        isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-transparent" : ""
      }`}
      style={{
        left: shape.x,
        top: shape.y,
        backgroundColor: color,
        borderColor: isSelected ? "#fff" : "transparent",
      }}
    >
      <span className="text-[10px] opacity-75">{icon}</span>
      <span className="max-w-full truncate px-1">{shape.label}</span>
    </div>
  );
}
