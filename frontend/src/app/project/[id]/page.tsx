"use client";

import { useParams, useRouter } from "next/navigation";
import { UserButton, useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { WSClient } from "@/lib/ws";
import { ChatMessage, WSMessage } from "@/lib/types";
import { api } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";
import ChatSidebar, { type SendOptions } from "@/components/chat/ChatSidebar";
import ThemeToggle from "@/components/ThemeToggle";

// Dynamic import to avoid SSR issues with canvas
const Canvas = dynamic(() => import("@/components/canvas/Canvas"), { ssr: false });

type SaveStatus = "loading" | "saved" | "saving" | "error";

const SAVE_DELAY_MS = 1200;

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  // Keep the latest getToken without making effects depend on it.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const loadDesign = useCanvasStore((s) => s.loadDesign);
  const shapeCount = useCanvasStore((s) => s.shapes.length);
  const edgeCount = useCanvasStore((s) => s.edges.length);
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [projectName, setProjectName] = useState("Untitled canvas");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const wsRef = useRef<WSClient | null>(null);

  // Saving only starts after the saved canvas has been loaded, so an empty
  // canvas never overwrites what is stored.
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  // Show the project's real name in the title bar (falls back to "Untitled canvas").
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const project = (await api.getProject(projectId, token)) as { name?: string };
        if (!cancelled && project?.name) setProjectName(project.name);
      } catch {
        // keep the default name
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, projectId]);

  // ---- Load the saved canvas ----------------------------------------------
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    loadedRef.current = false;
    setSaveStatus("loading");
    loadDesign([], []); // clear whatever the previous project left behind
    useCanvasStore.getState().clearHistory();

    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error("No session token");
        const canvas = await api.getCanvas(projectId, token);
        if (cancelled) return;
        loadDesign(canvas.shapes ?? [], canvas.edges ?? []);
        // The loaded canvas is where Undo starts, so Undo can never empty it.
        useCanvasStore.getState().clearHistory();
        loadedRef.current = true;
        setSavedAt(canvas.updated_at ? new Date(canvas.updated_at) : null);
        setSaveStatus("saved");
      } catch {
        if (!cancelled) setSaveStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, projectId, loadDesign]);

  // ---- Save automatically after changes -----------------------------------
  const saveNow = useCallback(async () => {
    saveTimer.current = null;
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error("No session token");
      const { shapes, edges } = useCanvasStore.getState();
      await api.saveCanvas(projectId, shapes, edges, token);
      setSavedAt(new Date());
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [projectId]);

  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe((state, prev) => {
      if (!loadedRef.current) return;
      if (state.shapes === prev.shapes && state.edges === prev.edges) return;
      setSaveStatus("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(saveNow, SAVE_DELAY_MS);
    });
    return () => {
      unsubscribe();
      // Leaving the page: save right away if a change is still waiting.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        void saveNow();
      }
    };
  }, [saveNow]);

  // ---- Live updates from other people -------------------------------------
  const handleConnect = useCallback(
    (pid: string) => {
      if (wsRef.current) return; // already connected

      getTokenRef.current().then((t) => {
        if (!t || wsRef.current) return;
        const ws = new WSClient(pid, t);
        wsRef.current = ws;

        ws.onMessage((msg: WSMessage) => {
          switch (msg.type) {
            case "ai_message":
              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: msg.content as string,
                  timestamp: new Date().toISOString(),
                },
              ]);
              if (msg.design) {
                const { shapes, edges } = msg.design as {
                  shapes: Parameters<typeof loadDesign>[0];
                  edges: Parameters<typeof loadDesign>[1];
                };
                loadDesign(shapes, edges);
              }
              setIsProcessing(false);
              break;
            case "ai_spec":
              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: `Spec generated: ${msg.blob_url}`,
                  timestamp: new Date().toISOString(),
                },
              ]);
              break;
            case "error":
              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: `Error: ${msg.message}`,
                  timestamp: new Date().toISOString(),
                },
              ]);
              setIsProcessing(false);
              break;
          }
        });

        ws.connect();
      });
    },
    [loadDesign]
  );

  const handleWSSend = useCallback((msg: { type: string; [key: string]: unknown }) => {
    wsRef.current?.send(msg as WSMessage);
  }, []);

  // ---- Chat ---------------------------------------------------------------
  const handleSendChat = useCallback(
    async (content: string, options?: SendOptions) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      try {
        const token = await getTokenRef.current();
        if (!token) {
          throw new Error("Could not get a session token. Try signing in again.");
        }

        // For questions, send a compact copy of the canvas so the AI can talk about it.
        let context: unknown;
        if (options?.mode === "ask") {
          const { shapes, edges } = useCanvasStore.getState();
          const nameOf = new Map(shapes.map((s) => [s.id, s.label]));
          context = {
            components: shapes.map((s) => ({
              name: s.label,
              type: s.type,
              tech: s.tech,
              description: s.description,
              columns: s.columns,
            })),
            connections: edges.map((e) => ({
              from: nameOf.get(e.from),
              to: nameOf.get(e.to),
              label: e.label,
            })),
          };
        }

        const result = await api.sendChat(projectId, content, token, { ...options, context });

        if (result.reply) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: result.reply as string,
              timestamp: new Date().toISOString(),
            },
          ]);
        }

        if (result.design) {
          loadDesign(result.design.shapes, result.design.edges);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : "Failed to send chat"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsProcessing(false);
      }
    },
    [projectId, loadDesign]
  );

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  const savedTime = savedAt
    ? savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-3 text-left"
          aria-label="Back to projects"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
              <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" />
            </svg>
          </span>
          <span>
            <span className="block text-sm font-semibold leading-tight text-slate-900">
              Ghost AI
            </span>
            <span className="hidden text-[11px] leading-tight text-slate-500 sm:block">
              Describe it. See it. Refine it.
            </span>
          </span>
        </button>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Canvas title bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Your canvas
              </p>
              <h1 className="truncate text-lg font-semibold leading-tight text-slate-900">
                {projectName}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                {shapeCount} {shapeCount === 1 ? "component" : "components"}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                {edgeCount} {edgeCount === 1 ? "connection" : "connections"}
              </span>

              {saveStatus === "error" ? (
                <button
                  type="button"
                  onClick={() => {
                    setSaveStatus("saving");
                    void saveNow();
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700 hover:bg-red-100"
                  title="The canvas could not be saved. Click to try again."
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  Not saved · Retry
                </button>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      saveStatus === "saved" ? "bg-emerald-500" : "animate-pulse bg-amber-500"
                    }`}
                  />
                  {saveStatus === "loading"
                    ? "Loading..."
                    : saveStatus === "saving"
                    ? "Saving..."
                    : savedTime
                    ? `Saved · ${savedTime}`
                    : "Saved"}
                </span>
              )}
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <Canvas
              projectId={projectId}
              userId={user!.id}
              projectName={projectName}
              onConnect={handleConnect}
              wsSend={handleWSSend}
            />
          </div>
        </div>

        <ChatSidebar
          messages={messages}
          onSend={handleSendChat}
          isProcessing={isProcessing}
          projectId={projectId}
          projectName={projectName}
        />
      </div>
    </div>
  );
}
