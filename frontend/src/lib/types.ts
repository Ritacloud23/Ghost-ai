export type ShapeType = "database" | "service" | "queue" | "client" | "gateway" | "cache";

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  label: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
}

export interface Cursor {
  x: number;
  y: number;
  user_id: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Project {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Snapshot {
  id: string;
  project_id: string;
  blob_url: string;
  created_at: string;
}

export type WSMessageType =
  | "join"
  | "leave"
  | "presence"
  | "cursor_move"
  | "shape_add"
  | "shape_update"
  | "shape_delete"
  | "edge_add"
  | "edge_delete"
  | "chat_message"
  | "ai_message"
  | "ai_spec"
  | "error";

export interface WSMessage {
  type: WSMessageType;
  [key: string]: unknown;
}
