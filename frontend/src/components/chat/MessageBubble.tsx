"use client";

import { ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
          isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <span className={`mt-1 block text-[10px] ${isUser ? "text-blue-200" : "text-gray-400"}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
