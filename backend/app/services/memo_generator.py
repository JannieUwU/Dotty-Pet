"""
Async background task that generates the daily memo for a given date.

Design decisions:
- Runs via asyncio.create_task — fully decoupled from the HTTP request lifecycle.
- Module-level _generating set prevents duplicate concurrent runs for the same
  (user_id, date) pair (handles React StrictMode double-invocations and rapid
  "Regenerate" clicks).
- Uses INSERT OR IGNORE so concurrent DB writes are idempotent.
- Broadcasts memo_ready over WebSocket when done so the frontend can re-fetch
  without polling.
"""

import asyncio
import json
import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.database.connection import SessionLocal
from app.database.models import Event, Habit, HabitCheck, FocusSession, PetDailyMemo
from app.services.ai_service import get_backend
from app.services.pet_prompt import build_memo_system_prompt
from app.services.ws_server import ws_manager

log = logging.getLogger(__name__)

# Module-level concurrency guard — no Redis needed for a single-process app.
_generating: set[str] = set()


def _lock_key(user_id: int, memo_date: str) -> str:
    return f"{user_id}:{memo_date}"


def yesterday() -> str:
    return (date.today() - timedelta(days=1)).isoformat()


# ── Data collection ────────────────────────────────────────────────────────────

def _collect_context(db: Session, user_id: int, memo_date: str) -> dict:
    """Query yesterday's activity data and return a structured dict."""

    events = (
        db.query(Event)
        .filter(Event.user_id == user_id, Event.date == memo_date)
        .order_by(Event.start_time)
        .all()
    )

    all_habits = (
        db.query(Habit)
        .filter(Habit.user_id == user_id, Habit.is_active == 1)
        .all()
    )
    habit_ids = [h.id for h in all_habits]

    # Guard against empty IN clause — SQLite raises a syntax error on IN ()
    checked_ids: set[int] = set()
    if habit_ids:
        checked_ids = {
            row.habit_id
            for row in db.query(HabitCheck)
            .filter(
                HabitCheck.habit_id.in_(habit_ids),
                HabitCheck.check_date == memo_date,
            )
            .all()
        }

    sessions = (
        db.query(FocusSession)
        .filter(FocusSession.user_id == user_id, FocusSession.date == memo_date)
        .all()
    )

    return {
        "date": memo_date,
        "events": [
            {"title": e.title, "time": e.start_time or ""}
            for e in events
        ],
        "habits_completed": [h.name for h in all_habits if h.id in checked_ids],
        "habits_total": len(all_habits),
        "focus_sessions": len(sessions),
        "focus_minutes": sum(s.focus_min for s in sessions),
    }


# ── AI generation ──────────────────────────────────────────────────────────────

async def _generate_text(context: dict) -> str:
    """Call AI backend and collect the full streamed response."""
    backend = get_backend()
    system_prompt = build_memo_system_prompt()
    user_message = json.dumps(context, ensure_ascii=False)

    messages = [{"role": "user", "content": user_message}]

    chunks: list[str] = []
    async for chunk in backend.stream(messages, system_prompt):
        chunks.append(chunk)

    return "".join(chunks).strip()


# ── Main entry point ───────────────────────────────────────────────────────────

async def generate_memo(user_id: int, memo_date: str) -> None:
    """
    Background task: generate and persist the daily memo.

    Safe to call multiple times — duplicate runs for the same key are silently
    dropped.  The caller should use asyncio.create_task() so this runs without
    blocking the HTTP response.
    """
    key = _lock_key(user_id, memo_date)
    if key in _generating:
        log.debug("memo_generator: already running for %s, skipping", key)
        return

    _generating.add(key)
    try:
        db: Session = SessionLocal()
        try:
            existing = (
                db.query(PetDailyMemo)
                .filter(
                    PetDailyMemo.user_id == user_id,
                    PetDailyMemo.memo_date == memo_date,
                )
                .first()
            )
            if existing:
                log.debug("memo_generator: memo already exists for %s", key)
                return

            context = _collect_context(db, user_id, memo_date)
        finally:
            db.close()

        log.info("memo_generator: generating memo for %s", key)
        content = await _generate_text(context)

        if not content:
            log.warning("memo_generator: AI returned empty content for %s", key)
            return

        # Persist — ORM write so EncryptedText TypeDecorator fires
        db = SessionLocal()
        try:
            memo = PetDailyMemo(
                user_id=user_id,
                memo_date=memo_date,
                content=content,
            )
            db.add(memo)
            try:
                db.commit()
            except Exception:
                db.rollback()  # UNIQUE constraint — another process beat us to it
        finally:
            db.close()

        log.info("memo_generator: memo saved for %s", key)

        await ws_manager.broadcast("memo_ready", {"date": memo_date, "user_id": user_id})

    except Exception:
        log.exception("memo_generator: unhandled error for %s", key)
    finally:
        _generating.discard(key)


def is_generating(user_id: int, memo_date: str) -> bool:
    return _lock_key(user_id, memo_date) in _generating


async def ensure_yesterday_memo(user_id: int = 1) -> None:
    """
    Called at startup and by the daily scheduler.
    Triggers memo generation only if yesterday's memo is missing.
    """
    memo_date = yesterday()
    db: Session = SessionLocal()
    try:
        existing = (
            db.query(PetDailyMemo)
            .filter(
                PetDailyMemo.user_id == user_id,
                PetDailyMemo.memo_date == memo_date,
            )
            .first()
        )
    finally:
        db.close()

    if existing:
        log.debug("memo_generator: yesterday's memo already exists (%s)", memo_date)
        return

    log.info("memo_generator: scheduling generation for %s", memo_date)
    asyncio.create_task(generate_memo(user_id, memo_date))
