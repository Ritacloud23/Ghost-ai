import { create } from "zustand";
import { Shape, Edge, Cursor } from "@/lib/types";

/** How database tables are drawn: compact cards, or a full table with every column. */
export type TableView = "card" | "columns";

/** How connection lines are drawn. */
export type LineStyle = "orthogonal" | "straight" | "curved";

/** Editor preferences. They are remembered in this browser and are not part of the diagram. */
export interface DiagramSettings {
  grid: boolean;
  gridSize: number;
  snap: boolean;
  lineStyle: LineStyle;
  arrowheads: boolean;
  showLabels: boolean;
}

export const DEFAULT_SETTINGS: DiagramSettings = {
  grid: true,
  gridSize: 20,
  snap: false,
  lineStyle: "orthogonal",
  arrowheads: true,
  showLabels: true,
};

function sanitizeSettings(raw: unknown): Partial<DiagramSettings> {
  const out: Partial<DiagramSettings> = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.grid === "boolean") out.grid = r.grid;
  if (typeof r.gridSize === "number" && Number.isFinite(r.gridSize)) {
    out.gridSize = Math.min(100, Math.max(5, Math.round(r.gridSize)));
  }
  if (typeof r.snap === "boolean") out.snap = r.snap;
  if (r.lineStyle === "orthogonal" || r.lineStyle === "straight" || r.lineStyle === "curved") {
    out.lineStyle = r.lineStyle;
  }
  if (typeof r.arrowheads === "boolean") out.arrowheads = r.arrowheads;
  if (typeof r.showLabels === "boolean") out.showLabels = r.showLabels;
  return out;
}

function initialSettings(): DiagramSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem("ghost-settings");
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...sanitizeSettings(JSON.parse(raw)) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function initialTableView(): TableView {
  if (typeof window === "undefined") return "card";
  try {
    return window.localStorage.getItem("ghost-table-view") === "columns" ? "columns" : "card";
  } catch {
    return "card";
  }
}

// ---- Undo / redo history -----------------------------------------------------
// Changes that happen close together (a drag, typing in a field) count as one step.

interface Snapshot {
  shapes: Shape[];
  edges: Edge[];
}

const HISTORY_LIMIT = 100;
const BURST_MS = 400;

let past: Snapshot[] = [];
let future: Snapshot[] = [];
let burstBefore: Snapshot | null = null;
let burstTimer: ReturnType<typeof setTimeout> | null = null;
let applying = false;

interface CanvasState {
  shapes: Shape[];
  edges: Edge[];
  cursors: Record<string, Cursor>;
  selectedShapeId: string | null;
  tableView: TableView;
  settings: DiagramSettings;
  canUndo: boolean;
  canRedo: boolean;

  addShape: (shape: Shape) => void;
  updateShape: (id: string, changes: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  addEdge: (edge: Edge) => void;
  updateEdge: (id: string, changes: Partial<Edge>) => void;
  deleteEdge: (id: string) => void;
  setCursor: (userId: string, cursor: Cursor) => void;
  removeCursor: (userId: string) => void;
  setSelectedShape: (id: string | null) => void;
  setTableView: (view: TableView) => void;
  updateSettings: (partial: Partial<DiagramSettings>) => void;
  loadDesign: (shapes: Shape[], edges: Edge[]) => void;
  undo: () => void;
  redo: () => void;
  /** Forget all undo steps. Call this after the saved canvas has loaded. */
  clearHistory: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  shapes: [],
  edges: [],
  cursors: {},
  selectedShapeId: null,
  tableView: initialTableView(),
  settings: initialSettings(),
  canUndo: false,
  canRedo: false,

  addShape: (shape) => set((s) => ({ shapes: [...s.shapes, shape] })),

  updateShape: (id, changes) =>
    set((s) => ({
      shapes: s.shapes.map((sh) => (sh.id === id ? { ...sh, ...changes } : sh)),
    })),

  deleteShape: (id) =>
    set((s) => ({
      shapes: s.shapes.filter((sh) => sh.id !== id),
      edges: s.edges.filter((e) => e.from !== id && e.to !== id),
    })),

  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),

  updateEdge: (id, changes) =>
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, ...changes } : e)),
    })),

  deleteEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  setCursor: (userId, cursor) =>
    set((s) => ({ cursors: { ...s.cursors, [userId]: cursor } })),

  removeCursor: (userId) =>
    set((s) => {
      const cursors = { ...s.cursors };
      delete cursors[userId];
      return { cursors };
    }),

  setSelectedShape: (id) => set({ selectedShapeId: id }),

  setTableView: (view) => {
    try {
      window.localStorage.setItem("ghost-table-view", view);
    } catch {
      // storage can be blocked: the view still changes for this visit
    }
    set({ tableView: view });
  },

  updateSettings: (partial) => {
    const next = { ...get().settings, ...sanitizeSettings(partial) };
    try {
      window.localStorage.setItem("ghost-settings", JSON.stringify(next));
    } catch {
      // storage can be blocked: the settings still change for this visit
    }
    set({ settings: next });
  },

  loadDesign: (shapes, edges) => set({ shapes, edges }),

  undo: () => {
    closeBurst();
    const target = past.pop();
    if (!target) return;
    const { shapes, edges } = get();
    future.push({ shapes, edges });
    applying = true;
    set({ shapes: target.shapes, edges: target.edges });
    applying = false;
    syncHistoryFlags();
  },

  redo: () => {
    closeBurst();
    const target = future.pop();
    if (!target) return;
    const { shapes, edges } = get();
    past.push({ shapes, edges });
    applying = true;
    set({ shapes: target.shapes, edges: target.edges });
    applying = false;
    syncHistoryFlags();
  },

  clearHistory: () => {
    if (burstTimer) clearTimeout(burstTimer);
    burstTimer = null;
    burstBefore = null;
    past = [];
    future = [];
    syncHistoryFlags();
  },
}));

function syncHistoryFlags() {
  useCanvasStore.setState({ canUndo: past.length > 0, canRedo: future.length > 0 });
}

/** Finish the current group of changes and store it as one undo step. */
function closeBurst() {
  if (burstTimer) {
    clearTimeout(burstTimer);
    burstTimer = null;
  }
  if (burstBefore) {
    past.push(burstBefore);
    if (past.length > HISTORY_LIMIT) past.shift();
    future = [];
    burstBefore = null;
    syncHistoryFlags();
  }
}

// Watch the diagram: the first change of a burst remembers what it looked like before.
useCanvasStore.subscribe((state, prev) => {
  if (applying) return;
  if (state.shapes === prev.shapes && state.edges === prev.edges) return;
  if (!burstBefore) burstBefore = { shapes: prev.shapes, edges: prev.edges };
  if (burstTimer) clearTimeout(burstTimer);
  burstTimer = setTimeout(closeBurst, BURST_MS);
});