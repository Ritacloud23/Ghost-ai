const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Projects
  listProjects: (token: string) => request<unknown[]>("/api/projects", {}, token),
  createProject: (name: string, token: string) =>
    request<unknown>("/api/projects", { method: "POST", body: JSON.stringify({ name }) }, token),
  getProject: (id: string, token: string) => request<unknown>(`/api/projects/${id}`, {}, token),

  // Snapshots
  listSnapshots: (projectId: string, token: string) =>
    request<unknown[]>(`/api/snapshots/${projectId}`, {}, token),
  createSnapshot: (projectId: string, blobUrl: string, token: string) =>
    request<unknown>("/api/snapshots", { method: "POST", body: JSON.stringify({ project_id: projectId, blob_url: blobUrl }) }, token),

  // Chat
  sendChat: (projectId: string, message: string, token: string) =>
    request<{ task_id: string; status: string }>(
      "/api/chat",
      { method: "POST", body: JSON.stringify({ project_id: projectId, message }) },
      token
    ),
};
