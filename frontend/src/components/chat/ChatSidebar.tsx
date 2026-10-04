"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { api, type ModelInfo } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";
import { buildSpecMarkdown, downloadText } from "@/lib/exportSpec";
import PeoplePanel from "./PeoplePanel";

export type DiagramKind = "architecture" | "erd";

export interface SendOptions {
  mode?: "generate" | "ask";
  diagram?: DiagramKind;
  model?: string | null;
}

interface ChatSidebarProps {
  messages: ChatMessage[];
  onSend: (content: string, options?: SendOptions) => void;
  isProcessing: boolean;
  projectId: string;
  projectName: string;
}

const SUGGESTIONS: Record<DiagramKind, string[]> = {
  architecture: [
    "An online store with login, product search, payments and order emails",
    "A real-time chat app with notifications and file sharing",
    "A video streaming platform with a CDN and recommendations",
  ],
  erd: [
    "A blog with users, posts, comments and tags",
    "A library with books, authors, members and loans",
    "An online store with customers, orders, products and payments",
  ],
};

const PLACEHOLDERS: Record<DiagramKind, string> = {
  architecture: "Describe a system, for example an online store with login and payments...",
  erd: "Describe the data, for example a blog with users, posts and comments...",
};

function SparkleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" />
    </svg>
  );
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "canvas"
  );
}

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export default function ChatSidebar({
  messages,
  onSend,
  isProcessing,
  projectId,
  projectName,
}: ChatSidebarProps) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const shapeCount = useCanvasStore((s) => s.shapes.length);

  const [tab, setTab] = useState<"assistant" | "people">("assistant");
  const [open, setOpen] = useState(false); // mobile drawer
  const [diagram, setDiagram] = useState<DiagramKind>("architecture");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState("auto");
  const [prompt, setPrompt] = useState("");
  const [question, setQuestion] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Remember the chosen model and diagram type between visits.
  useEffect(() => {
    try {
      const savedModel = localStorage.getItem("ghost-model");
      if (savedModel) setModel(savedModel);
      const savedDiagram = localStorage.getItem("ghost-diagram");
      if (savedDiagram === "architecture" || savedDiagram === "erd") setDiagram(savedDiagram);
    } catch {
      // storage can be blocked
    }
  }, []);

  // Load the list of free models once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const list = await api.listModels(token);
        if (!cancelled) setModels(list);
      } catch {
        // the picker just shows "Auto" if the list is not available
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If the saved model is no longer free, go back to automatic.
  useEffect(() => {
    if (models.length > 0 && model !== "auto" && !models.some((m) => m.id === model)) {
      setModel("auto");
    }
  }, [models, model]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing, tab]);

  // Grow the prompt box as the user types, up to about 5 lines.
  useEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  }, [prompt, tab]);

  const changeModel = (value: string) => {
    setModel(value);
    try {
      localStorage.setItem("ghost-model", value);
    } catch {
      // ignore
    }
  };

  const changeDiagram = (value: DiagramKind) => {
    setDiagram(value);
    try {
      localStorage.setItem("ghost-diagram", value);
    } catch {
      // ignore
    }
  };

  const chosenModel = model === "auto" ? null : model;

  const generate = () => {
    const value = prompt.trim();
    if (!value || isProcessing) return;
    onSend(value, { mode: "generate", diagram, model: chosenModel });
    setPrompt("");
  };

  const ask = () => {
    const value = question.trim();
    if (!value || isProcessing) return;
    onSend(value, { mode: "ask", model: chosenModel });
    setQuestion("");
  };

  const exportSpec = () => {
    const { shapes, edges } = useCanvasStore.getState();
    downloadText(`${slugify(projectName)}-spec.md`, buildSpecMarkdown(projectName, shapes, edges));
  };

  const tabClass = (active: boolean) =>
    `flex-1 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? "border-indigo-600 text-slate-900"
        : "border-transparent text-slate-500 hover:text-slate-800"
    }`;

  return (
    <>
      {/* Mobile: floating button that opens the panel */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-transform active:scale-95 md:hidden"
      >
        <SparkleIcon className="h-4 w-4" />
        Ask AI
        {isProcessing && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
          </span>
        )}
      </button>

      {/* Mobile: dark backdrop behind the open panel */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 md:static md:z-auto md:w-96 md:max-w-none md:translate-x-0 md:shadow-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
            <SparkleIcon />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Ghost AI</h2>
            <p className="truncate text-xs text-slate-500">A thinking partner for your design</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            aria-label="Close panel"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-2">
          <button type="button" onClick={() => setTab("assistant")} className={tabClass(tab === "assistant")}>
            Assistant
          </button>
          <button type="button" onClick={() => setTab("people")} className={tabClass(tab === "people")}>
            People
          </button>
        </div>

        {tab === "people" ? (
          <PeoplePanel projectId={projectId} />
        ) : (
          <>
            {/* Messages */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {messages.length === 0 && !isProcessing && (
                <div className="flex flex-col items-center pt-4 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <SparkleIcon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">What do you want to design?</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Pick a diagram type below, then try one of these or write your own.
                  </p>
                  <div className="mt-4 flex w-full flex-col gap-2">
                    {SUGGESTIONS[diagram].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setPrompt(s);
                          promptRef.current?.focus();
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const isError = !isUser && msg.content.startsWith("Error:");
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                    style={{ animation: "ghost-fade-up 0.25s ease-out" }}
                  >
                    {!isUser && (
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                        <SparkleIcon className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className={`flex max-w-[85%] flex-col ${isUser ? "items-end" : "items-start"}`}>
                      <div
                        className={`whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-relaxed ${
                          isUser
                            ? "rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                            : isError
                            ? "rounded-2xl rounded-bl-md border border-red-200 bg-red-50 text-red-700"
                            : "rounded-2xl rounded-bl-md bg-slate-100 text-slate-800"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="mt-1 px-1 text-[10px] text-slate-400">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex gap-2" style={{ animation: "ghost-fade-up 0.25s ease-out" }}>
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <SparkleIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                    <span className="ml-2 text-xs text-slate-500">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Controls */}
            <div className="space-y-2 border-t border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Diagram
                  <select
                    value={diagram}
                    onChange={(e) => changeDiagram(e.target.value as DiagramKind)}
                    className={`${selectClass} mt-1 normal-case tracking-normal`}
                  >
                    <option value="architecture">Architecture</option>
                    <option value="erd">ER diagram</option>
                  </select>
                </label>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Model
                  <select
                    value={model}
                    onChange={(e) => changeModel(e.target.value)}
                    className={`${selectClass} mt-1 normal-case tracking-normal`}
                  >
                    <option value="auto">Auto (free)</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    generate();
                  }
                }}
                rows={2}
                placeholder={PLACEHOLDERS[diagram]}
                className="max-h-[110px] w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={generate}
                  disabled={isProcessing || !prompt.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {diagram === "erd" ? "+ Generate ER diagram" : "+ Generate architecture"}
                </button>
                <button
                  type="button"
                  onClick={exportSpec}
                  disabled={shapeCount === 0}
                  title="Download a Markdown spec of the canvas"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Export spec
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      ask();
                    }
                  }}
                  placeholder="Ask a question about this design..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={ask}
                  disabled={isProcessing || !question.trim()}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Ask
                </button>
              </div>

              <p className="text-center text-[10px] text-slate-400">
                Enter to generate · Shift+Enter for a new line · AI can make mistakes
              </p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
