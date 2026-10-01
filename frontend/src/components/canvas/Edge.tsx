"use client";

import { Edge as EdgeType, Shape } from "@/lib/types";

interface EdgeProps {
  edge: EdgeType;
  shapes: Shape[];
}

export default function Edge({ edge, shapes }: EdgeProps) {
  const fromShape = shapes.find((s) => s.id === edge.from);
  const toShape = shapes.find((s) => s.id === edge.to);

  if (!fromShape || !toShape) return null;

  const fromX = fromShape.x + 48; // half of w-24
  const fromY = fromShape.y + 32; // half of h-16
  const toX = toShape.x + 48;
  const toY = toShape.y + 32;

  const midX = (fromX + toX) / 2;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full">
      <path
        d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
        stroke="#9CA3AF"
        strokeWidth={2}
        fill="none"
        markerEnd="url(#arrowhead)"
      />
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
        </marker>
      </defs>
    </svg>
  );
}
