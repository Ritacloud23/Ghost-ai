export type ShapeType =
  | "client"
  | "user"
  | "cdn"
  | "loadbalancer"
  | "gateway"
  | "service"
  | "function"
  | "auth"
  | "database"
  | "cache"
  | "storage"
  | "search"
  | "queue"
  | "monitoring"
  | "external"
  | "entity";

/** One column of a database table (an "entity" shape). */
export interface ShapeColumn {
  name: string;
  type: string;
  /** "pk" = primary key, "fk" = foreign key. */
  key?: "pk" | "fk";
}

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  label: string;
  /** Technology name shown under the title, for example "PostgreSQL". */
  tech?: string;
  /** One short line shown on the card. */
  description?: string;
  /** Columns, only used when type is "entity". */
  columns?: ShapeColumn[];
  /** Custom width and height, set when the user resizes the card. */
  w?: number;
  h?: number;
  /** Custom accent color (#RRGGBB). Empty or missing means the default for its type. */
  color?: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  /** Short word shown on the arrow, for example "calls" or "1:N". */
  label?: string;
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