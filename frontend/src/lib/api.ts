import type { Shape, Edge } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Token = string | null | undefined;

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: Token
): Promise<T> {
  // Use the token passed in; if none, fall back to Clerk's current session (browser only).
  let authToken: Token = token;
  if (!authToken && typeof window !== "undefined") {
    authToken = await (window as any).Clerk?.session?.getToken();
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

export interface ChatDesign {
  shapes: Shape[];
  edges: Edge[];
}

export interface ChatResult {
  task_id: string;
  status: string;
  reply?: string;
  design?: ChatDesign | null;
}

export interface SendChatOptions {
  /** "generate" draws on the canvas, "ask" answers a question about it. */
  mode?: "generate" | "ask";
  diagram?: "architecture" | "erd";
  /** A specific free model to try first. Empty means automatic. */
  model?: string | null;
  /** The current canvas, for ask mode. */
  context?: unknown;
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface Member {
  user_id: string;
  name: string | null;
  email: string;
  role: string;
  is_you: boolean;
}

export interface CanvasData {
  shapes: Shape[];
  edges: Edge[];
  updated_at: string | null;
}

export const api = {
  // Projects
  listProjects: (token?: Token) => request<unknown[]>("/api/projects", {}, token),
  createProject: (name: string, token?: Token) =>
    request<unknown>(
      "/api/projects",
      { method: "POST", body: JSON.stringify({ name }) },
      token
    ),
  getProject: (id: string, token?: Token) =>
    request<unknown>(`/api/projects/${id}`, {}, token),

  // Canvas (saved shapes and arrows)
  getCanvas: (projectId: string, token?: Token) =>
    request<CanvasData>(`/api/projects/${projectId}/canvas`, {}, token),
  saveCanvas: (projectId: string, shapes: Shape[], edges: Edge[], token?: Token) =>
    request<{ saved: boolean; updated_at: string }>(
      `/api/projects/${projectId}/canvas`,
      { method: "PUT", body: JSON.stringify({ shapes, edges }) },
      token
    ),

  // People
  listMembers: (projectId: string, token?: Token) =>
    request<Member[]>(`/api/projects/${projectId}/members`, {}, token),
  inviteMember: (projectId: string, email: string, token?: Token) =>
    request<Member>(
      `/api/projects/${projectId}/members`,
      { method: "POST", body: JSON.stringify({ email }) },
      token
    ),

  // Snapshots
  listSnapshots: (projectId: string, token?: Token) =>
    request<unknown[]>(`/api/snapshots/${projectId}`, {}, token),
  createSnapshot: (projectId: string, blobUrl: string, token?: Token) =>
    request<unknown>(
      "/api/snapshots",
      {
        method: "POST",
        body: JSON.stringify({ project_id: projectId, blob_url: blobUrl }),
      },
      token
    ),

  // Chat
  listModels: (token?: Token) => request<ModelInfo[]>("/api/chat/models", {}, token),
  sendChat: (
    projectId: string,
    message: string,
    token?: Token,
    options?: SendChatOptions
  ) =>
    request<ChatResult>(
      "/api/chat",
      {
        method: "POST",
        body: JSON.stringify({ project_id: projectId, message, ...options }),
      },
      token
    ),
};