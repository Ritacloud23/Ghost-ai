import json
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # project_id -> set of WebSockets
        self.rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.rooms:
            self.rooms[project_id] = set()
        self.rooms[project_id].add(websocket)

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.rooms:
            self.rooms[project_id].discard(websocket)
            if not self.rooms[project_id]:
                del self.rooms[project_id]

    async def broadcast(self, project_id: str, message: dict, exclude: WebSocket | None = None):
        if project_id not in self.rooms:
            return
        disconnected = []
        for ws in self.rooms[project_id]:
            if ws is exclude:
                continue
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.rooms[project_id].discard(ws)

    async def send_to(self, websocket: WebSocket, message: dict):
        await websocket.send_text(json.dumps(message))


manager = ConnectionManager()
