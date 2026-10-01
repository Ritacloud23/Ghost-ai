"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/lib/types";
import MessageBubble from "./MessageBubble";

interface ChatSidebarProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  isProcessing: boolean;
}

export default function ChatSidebar({ messages, onSend, isProcessing }: ChatSidebarProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex h-full w-80 flex-col border-l border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">AI Assistant</h2>
        <p className="text-xs text-gray-500">Describe your system, and I'll design it</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-500">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your system..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
