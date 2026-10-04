import type { ShapeType } from "@/lib/types";
import { SHAPE_META } from "@/lib/shapeConfig";
import ShapeGlyph from "./ShapeGlyph";

/** Small icon for a shape type: the outline for regular shapes, a table for entities. */
export default function TypeIcon({ type }: { type: ShapeType }) {
  if (type !== "entity") return <ShapeGlyph type={type} />;

  const color = SHAPE_META.entity.color;
  return (
    <svg
      viewBox="0 0 132 76"
      className="h-full w-full"
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <rect x={14} y={4} width={104} height={68} rx={8} fill="#ffffff" stroke={color} strokeWidth={3} />
      <path d="M14 26 V12 a8 8 0 0 1 8 -8 H110 a8 8 0 0 1 8 8 V26 Z" fill={color} />
      <line x1={14} y1={42} x2={118} y2={42} stroke={color} strokeOpacity={0.35} strokeWidth={2} />
      <line x1={14} y1={58} x2={118} y2={58} stroke={color} strokeOpacity={0.35} strokeWidth={2} />
      <line x1={46} y1={26} x2={46} y2={72} stroke={color} strokeOpacity={0.35} strokeWidth={2} />
    </svg>
  );
}
