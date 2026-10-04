import type { Edge as EdgeData, Shape } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas";
import { shapeHeight, shapeWidth } from "@/lib/shapeConfig";

interface EdgeProps {
  edge: EdgeData;
  shapes: Shape[];
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}

interface Pt {
  x: number;
  y: number;
}

/** A line through the points, with softly rounded corners. */
function roundedPath(points: Pt[], radius: number): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const outLen = Math.hypot(next.x - curr.x, next.y - curr.y);
    if (inLen === 0 || outLen === 0) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const a = {
      x: curr.x - ((curr.x - prev.x) / inLen) * r,
      y: curr.y - ((curr.y - prev.y) / inLen) * r,
    };
    const b = {
      x: curr.x + ((next.x - curr.x) / outLen) * r,
      y: curr.y + ((next.y - curr.y) / outLen) * r,
    };
    d += ` L ${a.x} ${a.y} Q ${curr.x} ${curr.y} ${b.x} ${b.y}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

type End = "one" | "many";

const CARDINALITY_RE = /^([1NM])\s*[:\-]\s*([1NM])$/i;

/** Reads labels like "1:N", "1:1" or "N:M" (left side is the line's start). */
function parseCardinality(label?: string): { from: End; to: End } | null {
  const m = label?.trim().match(CARDINALITY_RE);
  if (!m) return null;
  const side = (value: string): End => (value === "1" ? "one" : "many");
  return { from: side(m[1].toUpperCase()), to: side(m[2].toUpperCase()) };
}

/** Crow's-foot symbol at one end of a relationship line. `out` points away from the table. */
function EndSymbol({ x, y, out, kind, color }: { x: number; y: number; out: Pt; kind: End; color: string }) {
  const px = -out.y; // perpendicular to the line
  const py = out.x;

  if (kind === "one") {
    const cx = x + out.x * 12;
    const cy = y + out.y * 12;
    return (
      <line
        x1={cx + px * 7}
        y1={cy + py * 7}
        x2={cx - px * 7}
        y2={cy - py * 7}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  }

  const ax = x + out.x * 16;
  const ay = y + out.y * 16;
  return (
    <g stroke={color} strokeWidth={2} strokeLinecap="round" fill="none">
      <line x1={ax} y1={ay} x2={x + px * 8} y2={y + py * 8} />
      <line x1={ax} y1={ay} x2={x} y2={y} />
      <line x1={ax} y1={ay} x2={x - px * 8} y2={y - py * 8} />
    </g>
  );
}

export default function Edge({ edge, shapes, selected = false, onSelect, onDelete }: EdgeProps) {
  // Hooks must run before any early return.
  const tableView = useCanvasStore((s) => s.tableView);

  const from = shapes.find((s) => s.id === edge.from);
  const to = shapes.find((s) => s.id === edge.to);
  if (!from || !to) return null;

  const fw = shapeWidth(from);
  const fh = shapeHeight(from);
  const tw = shapeWidth(to);
  const th = shapeHeight(to);

  const fromCx = from.x + fw / 2;
  const toCx = to.x + tw / 2;
  const stacked = Math.abs(toCx - fromCx) < ((fw + tw) / 2) * 0.9;

  // The route (right angles), where the label sits, and which way each end faces.
  const route = (() => {
    if (stacked) {
      // Above/below each other: leave from the bottom (or top) and enter the other side.
      const down = to.y >= from.y;
      const start: Pt = { x: fromCx, y: down ? from.y + fh : from.y };
      const end: Pt = { x: toCx, y: down ? to.y : to.y + th };
      const midY = (start.y + end.y) / 2;
      const straight = Math.abs(start.x - end.x) < 1;
      return {
        points: straight
          ? [start, end]
          : [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end],
        mid: { x: (start.x + end.x) / 2, y: midY },
        outStart: { x: 0, y: down ? 1 : -1 },
        outEnd: { x: 0, y: down ? -1 : 1 },
        start,
        end,
      };
    }
    // Side by side: leave from the right (or left) edge.
    const forward = toCx > fromCx;
    const start: Pt = { x: forward ? from.x + fw : from.x, y: from.y + fh / 2 };
    const end: Pt = { x: forward ? to.x : to.x + tw, y: to.y + th / 2 };
    const midX = (start.x + end.x) / 2;
    const straight = Math.abs(start.y - end.y) < 1;
    return {
      points: straight
        ? [start, end]
        : [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
      mid: { x: midX, y: (start.y + end.y) / 2 },
      outStart: { x: forward ? 1 : -1, y: 0 },
      outEnd: { x: forward ? -1 : 1, y: 0 },
      start,
      end,
    };
  })();

  const d = roundedPath(route.points, 14);
  const { x: mx, y: my } = route.mid;

  // Full tables with a label like "1:N" get crow's-foot ends. Cards get a plain line with an arrowhead.
  const cardinality =
    tableView === "columns" && from.type === "entity" && to.type === "entity"
      ? parseCardinality(edge.label)
      : null;

  // Labels read as lowercase words ("calls", "writes"); relationship labels stay as "1:N".
  const rawLabel = edge.label ?? "";
  const displayLabel = CARDINALITY_RE.test(rawLabel.trim())
    ? rawLabel.trim().toUpperCase()
    : rawLabel.toLowerCase();

  const markerId = `arrow-${edge.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const lineColor = selected ? "#3B82F6" : "#4B5563";
  const labelWidth = displayLabel ? Math.max(30, displayLabel.length * 6.6 + 18) : 0;

  return (
    <g>
      {!cardinality && (
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" fill={lineColor} />
          </marker>
        </defs>
      )}

      {/* Visible line */}
      <path
        d={d}
        fill="none"
        stroke={lineColor}
        strokeWidth={selected ? 2.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={cardinality ? undefined : `url(#${markerId})`}
      />

      {/* Crow's-foot ends */}
      {cardinality && (
        <>
          <EndSymbol
            x={route.start.x}
            y={route.start.y}
            out={route.outStart}
            kind={cardinality.from}
            color={lineColor}
          />
          <EndSymbol
            x={route.end.x}
            y={route.end.y}
            out={route.outEnd}
            kind={cardinality.to}
            color={lineColor}
          />
        </>
      )}

      {/* Wide invisible path so the line is easy to click */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ pointerEvents: "stroke", cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
      />

      {/* Label (also shown while selected, above the delete button) */}
      {displayLabel && (
        <g
          transform={`translate(${mx} ${selected ? my - 24 : my})`}
          style={{ pointerEvents: "none" }}
        >
          <rect
            className={selected ? "ghost-edge-label-bg ghost-edge-label-bg-selected" : "ghost-edge-label-bg"}
            x={-labelWidth / 2}
            y={-10}
            width={labelWidth}
            height={20}
            rx={10}
          />
          <text
            className="ghost-edge-label-text"
            textAnchor="middle"
            y={4}
            fontSize={11}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {displayLabel}
          </text>
        </g>
      )}

      {/* Delete button on the selected line */}
      {selected && onDelete && (
        <g
          transform={`translate(${mx} ${my})`}
          style={{ pointerEvents: "all", cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <circle className="ghost-edge-delete-bg" r={12} stroke="#EF4444" strokeWidth={2} />
          <path
            d="M-4 -4 L4 4 M4 -4 L-4 4"
            stroke="#EF4444"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
}
