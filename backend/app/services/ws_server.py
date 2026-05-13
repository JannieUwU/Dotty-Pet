"""WebSocket server on port 8767 for push notifications to Electron."""
import asyncio
import json
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect
from fastapi import APIRouter

router = APIRouter()
_clients: Set[WebSocket] = set()


async def broadcast(event: str, data: dict):
    msg = json.dumps({"event": event, "data": data})
    dead = set()
    for ws in _clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    _clients.difference_update(dead)


class _WSManager:
    async def broadcast(self, event: str, data: dict):
        await broadcast(event, data)


ws_manager = _WSManager()


async def close_all_clients() -> None:
    """Close every active WebSocket connection. Call during app shutdown."""
    for ws in list(_clients):
        try:
            await ws.close(code=1001)  # 1001 = Going Away
        except Exception:
            pass
    _clients.clear()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    _clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        _clients.discard(websocket)
