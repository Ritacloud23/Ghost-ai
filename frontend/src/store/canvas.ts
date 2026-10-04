import { create } from "zustand";
import { Shape, Edge, Cursor } from "@/lib/types";

/** How database tables are drawn: compact cards, or a full table with every column. */
export type TableView = "card" | "columns";

function initialTableView(): TableView {
  if (typeof window === "undefined") return "card";
  try {
    return window.localStorage.getItem("ghost-table-view") === "columns" ? "columns" : "card";
  } catch {
    return "card";
  }
}

interface CanvasState {
  shapes: Shape[];
  edges: Edge[];
  cursors: Record<string, Cursor>;
  selectedShapeId: string | null;
  tableView: TableView;

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
  loadDesign: (shapes: Shape[], edges: Edge[]) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  shapes: [],
  edges: [],
  cursors: {},
  selectedShapeId: null,
  tableView: initialTableView(),

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

  loadDesign: (shapes, edges) => set({ shapes, edges }),
}));