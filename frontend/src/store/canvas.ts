import { create } from "zustand";
import { Shape, Edge, Cursor } from "@/lib/types";

interface CanvasState {
  shapes: Shape[];
  edges: Edge[];
  cursors: Record<string, Cursor>;
  selectedShapeId: string | null;

  addShape: (shape: Shape) => void;
  updateShape: (id: string, changes: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  addEdge: (edge: Edge) => void;
  deleteEdge: (id: string) => void;
  setCursor: (userId: string, cursor: Cursor) => void;
  removeCursor: (userId: string) => void;
  setSelectedShape: (id: string | null) => void;
  loadDesign: (shapes: Shape[], edges: Edge[]) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  shapes: [],
  edges: [],
  cursors: {},
  selectedShapeId: null,

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

  loadDesign: (shapes, edges) => set({ shapes, edges }),
}));
