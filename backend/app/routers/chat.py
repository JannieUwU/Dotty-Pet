"""Chat router — SSE streaming AI replies with intent detection."""
from datetime import date
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.ai_service import get_backend

router = APIRouter()

# ── Intent-aware system prompt ────────────────────────────────────────────────
# {today} is replaced at request time with the current date.
# NOTE: single braces — this is NOT an f-string, so { and } are literal.
_SYSTEM_TEMPLATE = """You are Dotty, a friendly and cute desktop pet assistant. Keep your replies concise and warm.

When the user expresses intent to add a schedule, reminder, or to-do item (e.g. "meeting tomorrow at 3pm", "report due next Monday", "doctor appointment the day after tomorrow at 10am"), you should:
1. Reply naturally and briefly, letting the user know you can help add the event.
2. After the reply text, on a new line, output the following marker (no code block, no extra spaces):

__INTENT__{"type":"add_event","title":"event title","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"","description":""}

Rules:
- date is calculated relative to today ({today}), strictly in YYYY-MM-DD format
- start_time is in HH:MM (24-hour), leave empty string if not mentioned
- end_time leave empty string if not mentioned
- title should be a concise summary of the event
- If there is not enough information to determine the date, do NOT output the __INTENT__ marker — ask the user instead
- Output at most one __INTENT__ marker per reply
- Output the JSON on a single line with no extra whitespace or markdown fences

For all other cases (casual chat, Q&A, etc.) reply normally and never output the __INTENT__ marker."""


def build_system() -> str:
    return _SYSTEM_TEMPLATE.replace("{today}", date.today().isoformat())


class ChatRequest(BaseModel):
    messages: list[dict]
    system: str = ""
    model: str = "qwen2.5"


@router.post("/")
async def chat(req: ChatRequest):
    system = req.system if req.system.strip() else build_system()
    backend = get_backend(req.model)

    async def generate():
        try:
            async for chunk in backend.stream(req.messages, system):
                # NDJSON: one JSON object per line.
                # Padding to 1 KB ensures Chromium/Electron flushes immediately
                # instead of buffering small frames until the connection closes.
                line = json.dumps({"t": chunk})
                padding = max(0, 1024 - len(line))
                yield line + (" " * padding) + "\n"
        except Exception as e:
            yield json.dumps({"error": str(e)}) + "\n"
        yield json.dumps({"done": True}) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
        },
    )
