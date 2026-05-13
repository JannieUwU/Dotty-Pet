"""Menu router — forwards right-click signals from Unity to Electron's menu server."""
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()

ELECTRON_MENU_URL = "http://127.0.0.1:8767/menu"

# Reuse a single client across requests to avoid per-request TCP connection overhead.
_client = httpx.AsyncClient(timeout=0.5)


@router.post("/menu")
async def forward_menu(request: Request):
    try:
        body = await request.body()
        await _client.post(ELECTRON_MENU_URL, content=body,
                           headers={"Content-Type": "application/json"})
    except Exception:
        pass  # Electron not running or not ready — silently ignore
    return JSONResponse({"ok": True})
