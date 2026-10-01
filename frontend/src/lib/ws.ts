import { WSMessage } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

type MessageHandler = (msg: WSMessage) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private url: string;

  constructor(projectId: string, token: string) {
    this.url = `${WS_URL}/ws/${projectId}?token=${token}`;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      // Auto-reconnect after 3s
      setTimeout(() => this.connect(), 3000);
    };
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(msg: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
