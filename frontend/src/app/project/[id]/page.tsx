"use client";

import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { WSClient } from "@/lib/ws";
import { ChatMessage, WSMessage } from "@/lib/types";
import { api } from "@/lib/api";
import ChatSidebar from "@/components/chat/ChatSidebar";

// Dynamic import to avoid SSR issues with canvas
const Canvas = dynamic(() => import("@/components/canvas/Canvas"), { ssr: false });

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const wsRef = useRef<WSClient | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  const handleConnect = useCallback(
    (pid: string) => {
      if (wsRef.current) return; // already connected

      const token = window.Clerk?.session?.getToken();
      if (!token) return;

      token.then((t) => {
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
                // Load AI-generated design onto canvas
                const { shapes, edges } = msg.design as { shapes: unknown[]; edges: unknown[] };
                // This would call loadDesign on the store
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
    []
  );

  const handleWSSend = useCallback((msg: { type: string; [key: string]: unknown }) => {
    wsRef.current?.send(msg);
  }, []);

  const handleSendChat = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      try {
        const token = await window.Clerk?.session?.getToken();
        if (!token) return;
        await api.sendChat(projectId, content, token);
      } catch (err) {
        console.error("Failed to send chat:", err);
        setIsProcessing(false);
      }
    },
    [projectId]
  );

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1">
        <Canvas
          projectId={projectId}
          userId={user!.id}
          onConnect={handleConnect}
          wsSend={handleWSSend}
        />
      </div>
      <ChatSidebar messages={messages} onSend={handleSendChat} isProcessing={isProcessing} />
    </div>
  );
}
