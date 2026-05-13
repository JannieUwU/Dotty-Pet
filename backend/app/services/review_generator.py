"""
Async background task that generates the daily review for a given date.

Design decisions:
- Runs via asyncio.create_task — fully decoupled from the HTTP request lifecycle.
- Module-level _generating set prevents duplicate concurrent runs for the same
  (user_id, date) pair (handles rapid clicks and scheduler overlap).
- Uses INSERT OR IGNORE so concurrent DB writes are idempotent.
- Broadcasts review_ready over WebSocket when done so the frontend can re-fetch.
- Retries JSON parsing up to MAX_RETRIES times before giving up.
- Falls back to safe defaults if AI returns partial/malformed JSON.

Context collected for the review:
  - Chat messages from that day (count + user message count for engagement signal)
  - Habit check completion (checked / total active, names of completed habits)
  - Focus sessions (count + total focus minutes + completion rate)
  - Calendar events
  - Current-month goals (completed / total)
  - User's personality setting (so the review tone matches the pet's style)
"""

import asyncio
import json
import logging
import re
from datetime import date, timedelta

# Reviews older than this many months are automatically pruned
REVIEW_RETENTION_MONTHS = 3

from sqlalchemy.orm import Session
from sqlalchemy import text as _text

from app.database.connection import SessionLocal
from app.database.models import (
    ChatMessage, Event, Goal, Habit, HabitCheck, FocusSession,
    PetDailyReview, Setting,
)
from app.services.ai_service import get_backend
from app.services.pet_prompt import build_review_system_prompt, build_review_user_prompt
from app.services.ws_server import ws_manager

log = logging.getLogger(__name__)

# Module-level concurrency guard — no Redis needed for a single-process app.
_generating: set[str] = set()

# How many times to retry if the AI returns malformed JSON
MAX_RETRIES = 2

# Safe fallback values used when AI output cannot be parsed at all
_FALLBACK = {"rating": 3, "mood": "😊", "title": "Daily Review", "content": "Keep it up!"}

# Valid mood emojis the AI is allowed to use
_VALID_MOODS = {"😊", "🎉", "💪", "✨", "🤔", "😴", "🌟", "💡"}


def _lock_key(user_id: int, review_date: str) -> str:
    return f"{user_id}:{review_date}"


def yesterday() -> str:
    return (date.today() - timedelta(days=1)).isoformat()


def _retention_cutoff() -> str:
    """Return the earliest date (inclusive) that should be kept.

    We approximate 3 months as 92 days — avoids calendar-month arithmetic
    while staying within a day or two of the true 3-month boundary.
    """
    return (date.today() - timedelta(days=92)).isoformat()


def prune_old_reviews(db: Session, user_id: int) -> int:
    """Delete reviews older than REVIEW_RETENTION_MONTHS months.

    Returns the number of rows deleted.
    """
    cutoff = _retention_cutoff()
    result = db.execute(
        _text(
            "DELETE FROM pet_daily_reviews "
            "WHERE user_id=:uid AND review_date < :cutoff"
        ),
        {"uid": user_id, "cutoff": cutoff},
    )
    db.commit()
    deleted = result.rowcount
    if deleted:
        log.info("review_generator: pruned %d old review(s) before %s", deleted, cutoff)
    return deleted


# ── Data collection ────────────────────────────────────────────────────────────

def _collect_context(db: Session, user_id: int, review_date: str) -> dict:
    """
    Query yesterday's activity data and return a structured dict.

    All queries use the stored date column directly (YYYY-MM-DD text) except
    chat_messages which stores a full datetime — we use SQLite's DATE() to
    extract just the date part for comparison.
    """

    # Chat messages — count total and user-only for engagement signal
    all_msgs = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.user_id == user_id,
            _text("DATE(created_at) = :d").bindparams(d=review_date),
        )
        .all()
    )
    user_msgs = [m for m in all_msgs if m.role == "user"]

    # Habits — active habits + which ones were checked that day
    all_habits = (
        db.query(Habit)
        .filter(Habit.user_id == user_id, Habit.is_active == 1)
        .all()
    )
    habit_ids = [h.id for h in all_habits]
    checked_ids: set[int] = set()
    if habit_ids:
        checked_ids = {
            row.habit_id
            for row in db.query(HabitCheck)
            .filter(
                HabitCheck.habit_id.in_(habit_ids),
                HabitCheck.check_date == review_date,
            )
            .all()
        }

    # Focus sessions — count + total focus minutes + completion rate
    sessions = (
        db.query(FocusSession)
        .filter(FocusSession.user_id == user_id, FocusSession.date == review_date)
        .all()
    )
    completed_sessions = [s for s in sessions if s.completed]
    total_focus_min = sum(s.focus_min for s in sessions)

    # Calendar events
    events = (
        db.query(Event)
        .filter(Event.user_id == user_id, Event.date == review_date)
        .order_by(Event.start_time)
        .all()
    )

    # Current-month goals (YYYY-MM of the review date)
    year_month = review_date[:7]
    goals = (
        db.query(Goal)
        .filter(Goal.user_id == user_id, Goal.year_month == year_month)
        .all()
    )

    # User's personality setting — so the review tone matches the pet's style
    personality_row = db.query(Setting).filter(Setting.key == "pet_personality").first()
    personality = personality_row.value if personality_row else ""

    return {
        "date": review_date,
        "personality": personality,
        # Chat engagement
        "chat_messages_total": len(all_msgs),
        "chat_messages_user": len(user_msgs),
        # Habits
        "habits_completed": len([h for h in all_habits if h.id in checked_ids]),
        "habits_total": len(all_habits),
        "habits_names_completed": [h.name for h in all_habits if h.id in checked_ids],
        "habits_names_missed": [h.name for h in all_habits if h.id not in checked_ids],
        # Focus
        "focus_sessions_total": len(sessions),
        "focus_sessions_completed": len(completed_sessions),
        "focus_minutes": total_focus_min,
        # Events
        "events": [{"title": e.title, "time": e.start_time or ""} for e in events],
        # Goals
        "goals_completed": sum(1 for g in goals if g.completed),
        "goals_total": len(goals),
    }


# ── JSON extraction ────────────────────────────────────────────────────────────

def _extract_json(raw: str) -> dict:
    """
    Robustly extract a JSON object from the AI's raw output.

    Handles:
    1. Clean JSON: {"rating": 4, ...}
    2. Markdown fenced: ```json\n{...}\n```
    3. JSON embedded in prose: "Here is your review: {...} Hope you like it!"
    4. Single-quoted JSON (some models): {'rating': 4}
    """
    text = raw.strip()

    # 1. Strip markdown code fences
    if "```" in text:
        # Grab content between first ``` pair
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if fence_match:
            text = fence_match.group(1).strip()

    # 2. Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Find the first {...} block in the text (handles prose wrapping)
    brace_match = re.search(r"\{[\s\S]*?\}", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    # 4. Replace single quotes with double quotes (some models output Python dicts)
    try:
        normalized = text.replace("'", '"')
        return json.loads(normalized)
    except json.JSONDecodeError:
        pass

    raise ValueError(f"Could not extract JSON from AI output: {text[:200]!r}")


def _validate_and_sanitize(parsed: dict) -> tuple[int, str, str, str]:
    """
    Validate and sanitize the parsed JSON fields.
    Returns (rating, mood, title, content) with safe fallbacks for each field.
    """
    # rating: must be int 1-5
    try:
        rating = int(parsed.get("rating", _FALLBACK["rating"]))
        rating = max(1, min(5, rating))
    except (TypeError, ValueError):
        rating = _FALLBACK["rating"]

    # mood: must be one of the allowed emojis
    mood = str(parsed.get("mood", _FALLBACK["mood"])).strip()
    if mood not in _VALID_MOODS:
        mood = _FALLBACK["mood"]

    # title: truncate to 20 chars (generous buffer over the 10-char prompt guideline)
    title = str(parsed.get("title", _FALLBACK["title"])).strip()
    if not title:
        title = _FALLBACK["title"]
    title = title[:20]

    # content: must be non-empty; truncate to 300 chars to prevent layout breaks
    content = str(parsed.get("content", "")).strip()
    if not content:
        content = _FALLBACK["content"]
    content = content[:300]

    return rating, mood, title, content


# ── AI generation ──────────────────────────────────────────────────────────────

async def _generate_json(context: dict) -> tuple[int, str, str, str]:
    """
    Call AI backend, parse the JSON response, and return validated fields.
    Retries up to MAX_RETRIES times on parse failure before using fallback.
    """
    backend = get_backend()
    # Pass personality so the review tone matches the pet's communication style
    system_prompt = build_review_system_prompt(context.get("personality", ""))
    # Remove personality from the data payload — it's already in the system prompt
    payload = {k: v for k, v in context.items() if k != "personality"}
    user_message = build_review_user_prompt(payload)
    messages = [{"role": "user", "content": user_message}]

    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 2):  # +2 so range covers MAX_RETRIES retries
        chunks: list[str] = []
        try:
            async for chunk in backend.stream(messages, system_prompt):
                chunks.append(chunk)
            raw = "".join(chunks).strip()
            if not raw:
                raise ValueError("AI returned empty response")
            parsed = _extract_json(raw)
            return _validate_and_sanitize(parsed)
        except Exception as exc:
            last_error = exc
            log.warning(
                "review_generator: JSON parse failed (attempt %d/%d): %s",
                attempt, MAX_RETRIES + 1, exc,
            )
            if attempt <= MAX_RETRIES:
                await asyncio.sleep(1)  # brief pause before retry

    # All retries exhausted — use fallback values so we still save something
    log.error(
        "review_generator: all retries failed, using fallback. Last error: %s", last_error
    )
    return (
        _FALLBACK["rating"],
        _FALLBACK["mood"],
        _FALLBACK["title"],
        _FALLBACK["content"],
    )


# ── Main entry point ───────────────────────────────────────────────────────────

async def generate_review(user_id: int, review_date: str) -> None:
    """
    Background task: generate and persist the daily review.

    Safe to call multiple times — duplicate runs for the same key are silently
    dropped.  The caller should use asyncio.create_task() so this runs without
    blocking the HTTP response.
    """
    key = _lock_key(user_id, review_date)
    if key in _generating:
        log.debug("review_generator: already running for %s, skipping", key)
        return

    _generating.add(key)
    try:
        # ── 1. Idempotency check + context collection ──────────────────────────
        db: Session = SessionLocal()
        try:
            existing = (
                db.query(PetDailyReview)
                .filter(
                    PetDailyReview.user_id == user_id,
                    PetDailyReview.review_date == review_date,
                )
                .first()
            )
            if existing:
                log.debug("review_generator: review already exists for %s", key)
                return

            context = _collect_context(db, user_id, review_date)
        finally:
            db.close()

        # ── 2. AI generation ──────────────────────────────────────────────────
        log.info("review_generator: generating for %s", key)
        rating, mood, title, content = await _generate_json(context)

        # ── 3. Persist ────────────────────────────────────────────────────────
        db = SessionLocal()
        try:
            review = PetDailyReview(
                user_id=user_id,
                review_date=review_date,
                rating=rating,
                mood=mood,
                title=title,
                content=content,
            )
            db.add(review)
            try:
                db.commit()
            except Exception:
                db.rollback()  # UNIQUE constraint — another process beat us to it
        finally:
            db.close()

        log.info("review_generator: review saved for %s (rating=%d)", key, rating)

        # ── 4. Push to frontend ───────────────────────────────────────────────
        await ws_manager.broadcast("review_ready", {
            "date": review_date,
            "user_id": user_id,
            # Include the review data so the frontend can update without a round-trip
            "review": {
                "date": review_date,
                "rating": rating,
                "mood": mood,
                "title": title,
                "content": content,
            },
        })

    except Exception:
        log.exception("review_generator: unhandled error for %s", key)
    finally:
        _generating.discard(key)


def is_generating(user_id: int, review_date: str) -> bool:
    return _lock_key(user_id, review_date) in _generating


async def ensure_yesterday_review(user_id: int = 1) -> None:
    """
    Called at startup and by the daily scheduler.
    Triggers generation only if yesterday's review is missing.
    Also prunes reviews older than REVIEW_RETENTION_MONTHS months.
    """
    review_date = yesterday()
    db: Session = SessionLocal()
    try:
        existing = (
            db.query(PetDailyReview)
            .filter(
                PetDailyReview.user_id == user_id,
                PetDailyReview.review_date == review_date,
            )
            .first()
        )
        # Prune old reviews on every daily run (startup + 00:01 cron)
        prune_old_reviews(db, user_id)
    finally:
        db.close()

    if existing:
        log.debug("review_generator: yesterday's review already exists (%s)", review_date)
        return

    log.info("review_generator: scheduling generation for %s", review_date)
    asyncio.create_task(generate_review(user_id, review_date))
