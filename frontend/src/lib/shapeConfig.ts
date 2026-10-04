import type { Shape, ShapeColumn, ShapeType } from "@/lib/types";
import { useCanvasStore } from "@/store/canvas";

// Default sizes. A card can be resized by the user (see the limits below).
export const SHAPE_W = 224;
export const SHAPE_H = 88;

// In "columns" view, database tables are wider and grow taller with every column.
export const ENTITY_W = 264;
export const ENTITY_HEADER_H = 42;
export const ENTITY_ROW_H = 28;
export const ENTITY_MAX_COLUMNS = 12;

// Resize limits.
export const MIN_CARD_W = 160;
export const MAX_CARD_W = 520;
export const MIN_CARD_H = 72;
export const MAX_CARD_H = 320;
export const MIN_ENTITY_W = 200;
export const MAX_ENTITY_W = 560;

// Two soft families, like a clean developer-docs diagram:
// ice-blue for services and components, sage-green for places where data lives.
const BLUE = "#2B6CA3";
const GREEN = "#2F7D5B";
const GRAY = "#6B7280";

export interface ShapeMeta {
  label: string;
  color: string;
  /** Short explanation shown in the Components panel. */
  description: string;
}

export const SHAPE_META: Record<ShapeType, ShapeMeta> = {
  client: { label: "Client", color: BLUE, description: "User-facing app or browser" },
  user: { label: "User", color: BLUE, description: "A person or role using the system" },
  cdn: { label: "CDN", color: BLUE, description: "Edge caching and fast delivery" },
  loadbalancer: { label: "Load Balancer", color: BLUE, description: "Spreads traffic across servers" },
  gateway: { label: "Gateway", color: BLUE, description: "Public entry point for requests" },
  service: { label: "Service", color: BLUE, description: "Compute or API endpoint" },
  function: { label: "Function", color: BLUE, description: "Serverless or scheduled job" },
  auth: { label: "Auth", color: BLUE, description: "Login and access control" },
  database: { label: "Database", color: GREEN, description: "Persistent storage" },
  cache: { label: "Cache", color: GREEN, description: "Fast in-memory data" },
  storage: { label: "Object Storage", color: GREEN, description: "Files, images and media" },
  search: { label: "Search", color: GREEN, description: "Full-text search index" },
  queue: { label: "Queue", color: BLUE, description: "Async buffer or event stream" },
  monitoring: { label: "Monitoring", color: BLUE, description: "Logs, metrics and alerts" },
  external: { label: "External API", color: GRAY, description: "Third-party service" },
  entity: { label: "Table", color: GREEN, description: "Database table with columns" },
};

// How the Components panel groups the shapes.
export const SHAPE_GROUPS: { name: string; types: ShapeType[] }[] = [
  { name: "Clients & edge", types: ["client", "user", "cdn", "loadbalancer", "gateway"] },
  { name: "Compute", types: ["service", "function", "auth"] },
  { name: "Data", types: ["database", "cache", "storage", "search"] },
  { name: "Messaging & ops", types: ["queue", "monitoring", "external"] },
  { name: "Database design", types: ["entity"] },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** True when tables are shown as compact cards instead of full tables. */
function tablesAsCards(): boolean {
  return useCanvasStore.getState().tableView === "card";
}

/** True when a shape is drawn as a full table with a row per column. */
export function isColumnsTable(shape: Pick<Shape, "type">): boolean {
  return shape.type === "entity" && !tablesAsCards();
}

/** Keeps a width inside the allowed range for this kind of shape. */
export function clampWidth(type: ShapeType, w: number): number {
  return type === "entity" && !tablesAsCards()
    ? clamp(w, MIN_ENTITY_W, MAX_ENTITY_W)
    : clamp(w, MIN_CARD_W, MAX_CARD_W);
}

/** Keeps a height inside the allowed range (cards only). */
export function clampHeight(h: number): number {
  return clamp(h, MIN_CARD_H, MAX_CARD_H);
}

export function shapeWidth(shape: Pick<Shape, "type" | "w">): number {
  if (isColumnsTable(shape)) {
    return typeof shape.w === "number" ? clamp(shape.w, MIN_ENTITY_W, MAX_ENTITY_W) : ENTITY_W;
  }
  return typeof shape.w === "number" ? clamp(shape.w, MIN_CARD_W, MAX_CARD_W) : SHAPE_W;
}

export function shapeHeight(shape: Pick<Shape, "type" | "columns" | "h">): number {
  if (isColumnsTable(shape)) {
    // A full table's height follows its columns.
    const total = shape.columns?.length ?? 0;
    const shown = Math.min(total, ENTITY_MAX_COLUMNS);
    const rows = Math.max(shown, 1) + (total > ENTITY_MAX_COLUMNS ? 1 : 0);
    return ENTITY_HEADER_H + rows * ENTITY_ROW_H + 8;
  }
  return typeof shape.h === "number" ? clampHeight(shape.h) : SHAPE_H;
}

/** The title a new shape gets. */
export function defaultLabel(type: ShapeType): string {
  return type === "entity" ? "new_table" : SHAPE_META[type].label;
}

/** The columns a new table starts with. */
export function defaultColumns(): ShapeColumn[] {
  return [{ name: "id", type: "uuid", key: "pk" }];
}

/** Turns "#RRGGBB" into an rgba() string with the given opacity. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}