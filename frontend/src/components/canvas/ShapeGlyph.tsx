import type { ReactNode } from "react";
import type { ShapeType } from "@/lib/types";
import { SHAPE_META } from "@/lib/shapeConfig";

const STROKE = "rgba(15, 23, 42, 0.28)";
const GLOSS = "rgba(255, 255, 255, 0.28)";

/** Draws the outline of a shape inside a 132 x 76 box. No label here. */
export default function ShapeGlyph({ type }: { type: ShapeType }) {
  const color = (SHAPE_META[type] ?? SHAPE_META.service).color;
  const solid = {
    fill: color,
    stroke: STROKE,
    strokeWidth: 2,
    strokeLinejoin: "round" as const,
  };

  let body: ReactNode;

  switch (type) {
    case "database":
      // Cylinder
      body = (
        <>
          <path d="M4 14 V62 A62 12 0 0 0 128 62 V14 Z" {...solid} />
          <path
            d="M4 38 A62 12 0 0 0 128 38"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={1.5}
          />
          <ellipse cx={66} cy={14} rx={62} ry={12} {...solid} />
          <ellipse cx={66} cy={14} rx={62} ry={12} fill={GLOSS} />
        </>
      );
      break;

    case "gateway":
      // Hexagon
      body = <polygon points="26,4 106,4 128,38 106,72 26,72 4,38" {...solid} />;
      break;

    case "client":
      // Monitor
      body = (
        <>
          <rect x={58} y={56} width={16} height={9} {...solid} />
          <rect x={40} y={64} width={52} height={7} rx={3.5} {...solid} />
          <rect x={6} y={4} width={120} height={53} rx={8} {...solid} />
        </>
      );
      break;

    case "user":
      // Person (head and shoulders)
      body = (
        <>
          <path d="M18 72 Q18 40 66 40 Q114 40 114 72 Z" {...solid} />
          <circle cx={66} cy={19} r={14} {...solid} />
        </>
      );
      break;

    case "cdn":
      // Cloud
      body = (
        <path
          d="M34 62 Q8 62 8 42 Q8 24 30 24 Q34 6 62 6 Q90 6 96 26 Q124 26 124 44 Q124 62 100 62 Z"
          {...solid}
        />
      );
      break;

    case "loadbalancer":
      // Diamond
      body = <polygon points="66,3 129,38 66,73 3,38" {...solid} />;
      break;

    case "function":
      // Arrow-shaped block (runs when triggered)
      body = <polygon points="4,8 98,8 128,38 98,68 4,68" {...solid} />;
      break;

    case "auth":
      // Shield
      body = (
        <path d="M66 4 L120 18 V40 Q120 62 66 72 Q12 62 12 40 V18 Z" {...solid} />
      );
      break;

    case "cache":
      // Dashed pill with a lightning bolt
      body = (
        <>
          <rect
            x={4}
            y={6}
            width={124}
            height={64}
            rx={22}
            {...solid}
            strokeDasharray="6 4"
          />
          <polygon
            points="112,14 104,28 110,28 106,40 120,22 113,22 118,14"
            fill="rgba(255,255,255,0.9)"
          />
        </>
      );
      break;

    case "storage":
      // Bucket
      body = (
        <>
          <path d="M10 14 L122 14 L108 66 Q66 78 24 66 Z" {...solid} />
          <ellipse cx={66} cy={14} rx={56} ry={9} {...solid} />
          <ellipse cx={66} cy={14} rx={56} ry={9} fill={GLOSS} />
        </>
      );
      break;

    case "search":
      // Magnifying glass
      body = (
        <>
          <line
            x1={104}
            y1={58}
            x2={122}
            y2={72}
            stroke={STROKE}
            strokeWidth={11}
            strokeLinecap="round"
          />
          <line
            x1={104}
            y1={58}
            x2={122}
            y2={72}
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <ellipse cx={66} cy={36} rx={58} ry={30} {...solid} />
        </>
      );
      break;

    case "queue":
      // Pipe with messages at both ends
      body = (
        <>
          <rect x={4} y={12} width={124} height={52} rx={26} {...solid} />
          <circle cx={22} cy={38} r={4} fill="rgba(255,255,255,0.65)" />
          <circle cx={110} cy={38} r={4} fill="rgba(255,255,255,0.65)" />
        </>
      );
      break;

    case "monitoring":
      // Dashboard card with a sparkline
      body = (
        <>
          <rect x={4} y={6} width={124} height={64} rx={12} {...solid} />
          <polyline
            points="16,60 36,50 54,56 74,42 94,50 116,34"
            fill="none"
            stroke="#34D399"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
      break;

    case "external":
      // Dashed outline: something outside your system
      body = (
        <rect
          x={4}
          y={6}
          width={124}
          height={64}
          rx={14}
          fill="#F9FAFB"
          stroke="#9CA3AF"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      );
      break;

    case "service":
    default:
      // Rounded box
      body = <rect x={4} y={6} width={124} height={64} rx={14} {...solid} />;
  }

  return (
    <svg
      viewBox="0 0 132 76"
      className="h-full w-full"
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}
