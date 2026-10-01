import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.ws.manager import manager

router = APIRouter()


@router.websocket("/ws/{project_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    project_id: str,
    token: str = Query(...),
):
    # TODO: Verify Clerk JWT token
    await manager.connect(websocket, project_id)

    # Notify others of join
    await manager.broadcast(project_id, {"type": "presence", "event": "join"}, exclude=websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            data["project_id"] = project_id
            await manager.broadcast(project_id, data, exclude=websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
        await manager.broadcast(project_id, {"type": "presence", "event": "leave"})
