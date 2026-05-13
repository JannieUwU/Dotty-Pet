"""
/pet  — Desktop Pet API

Endpoints:
  GET  /pet/daily-memo               Return memo for yesterday's date
  POST /pet/daily-memo/regenerate    Delete cached memo and re-trigger generation
  GET  /pet/personality              Return current personality prompt
  PUT  /pet/personality              Validate, sanitise, and save personality prompt
  GET  /pet/reviews                  Return all historical reviews (newest first)
  GET  /pet/reviews/today            Return yesterday's review status; auto-triggers if not started
  POST /pet/reviews/generate         Manually trigger yesterday's review generation
  POST /pet/reviews/{date}/regenerate  Delete and re-generate a specific date's review
"""

import asyncio
import logging
import re
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text as _text
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import PetDailyMemo, PetDailyReview, PetPersonalityHistory, Setting
from app.services.memo_generator import generate_memo, is_generating, yesterday
from app.services.review_generator import (
    generate_review,
    is_generating as review_is_generating,
    prune_old_reviews,
    _retention_cutoff,
)
from app.services.prompt_sanitizer import sanitize_personality
from app.dependencies import get_current_user_id

log = logging.getLogger(__name__)
router = APIRouter()

# Regex for validating YYYY-MM-DD path parameters
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_personality_row(db: Session, user_id: int):
    return db.query(Setting).filter(Setting.user_id == user_id, Setting.key == "pet_personality").first()


def _trigger_memo_generation(user_id: int, memo_date: str) -> None:
    """Fire-and-forget: schedule memo generation without blocking."""
    asyncio.create_task(generate_memo(user_id, memo_date))


def _trigger_review_generation(user_id: int, review_date: str) -> None:
    """Fire-and-forget: schedule review generation without blocking."""
    asyncio.create_task(generate_review(user_id, review_date))


def _review_to_dict(r: PetDailyReview) -> dict:
    return {
        "id": str(r.id),
        "date": r.review_date,
        "rating": r.rating,
        "mood": r.mood,
        "title": r.title,
        "content": r.content,
        "generated_at": r.generated_at,
    }


# ── daily memo ────────────────────────────────────────────────────────────────

@router.get("/daily-memo")
async def get_daily_memo(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    memo_date = yesterday()

    existing = (
        db.query(PetDailyMemo)
        .filter(PetDailyMemo.user_id == user_id, PetDailyMemo.memo_date == memo_date)
        .first()
    )
    if existing:
        return {
            "status": "ready",
            "content": existing.content,
            "generated_at": existing.generated_at,
            "memo_date": memo_date,
        }

    if is_generating(user_id, memo_date):
        return {"status": "generating", "memo_date": memo_date}

    _trigger_memo_generation(user_id, memo_date)
    return {"status": "generating", "memo_date": memo_date}


@router.post("/daily-memo/regenerate")
async def regenerate_daily_memo(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    memo_date = yesterday()

    db.execute(
        _text("DELETE FROM pet_daily_memos WHERE user_id=:uid AND memo_date=:dt"),
        {"uid": user_id, "dt": memo_date},
    )
    db.commit()

    _trigger_memo_generation(user_id, memo_date)
    return {"status": "generating", "memo_date": memo_date}


# ── personality ───────────────────────────────────────────────────────────────

@router.get("/personality")
def get_personality(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    row = _get_personality_row(db, user_id)
    return {
        "content": row.value if row else "",
        "updated_at": row.updated_at if row else "",
    }


class PersonalityIn(BaseModel):
    prompt: str


@router.put("/personality")
def update_personality(body: PersonalityIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    result = sanitize_personality(body.prompt)
    if not result.ok:
        raise HTTPException(422, detail={"ok": False, "reason": result.reason})

    cleaned = result.cleaned

    existing = db.query(Setting).filter(Setting.user_id == user_id, Setting.key == "pet_personality").first()
    if existing:
        existing.value = cleaned
    else:
        db.add(Setting(user_id=user_id, key="pet_personality", value=cleaned))
    db.add(PetPersonalityHistory(user_id=user_id, content=cleaned))
    db.commit()

    log.info("pet personality updated (len=%d)", len(cleaned))
    return {"ok": True, "cleaned": cleaned}


# ── reviews ───────────────────────────────────────────────────────────────────

@router.get("/reviews")
def get_reviews(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    cutoff = _retention_cutoff()
    rows = (
        db.query(PetDailyReview)
        .filter(
            PetDailyReview.user_id == user_id,
            PetDailyReview.review_date >= cutoff,
        )
        .order_by(PetDailyReview.review_date.desc())
        .all()
    )
    return {
        "reviews": [_review_to_dict(r) for r in rows],
        "total": len(rows),
        "retention_cutoff": cutoff,
    }


@router.get("/reviews/today")
async def get_today_review_status(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    review_date = yesterday()

    existing = (
        db.query(PetDailyReview)
        .filter(PetDailyReview.user_id == user_id, PetDailyReview.review_date == review_date)
        .first()
    )
    if existing:
        return {"status": "ready", "review": _review_to_dict(existing)}

    if not review_is_generating(user_id, review_date):
        _trigger_review_generation(user_id, review_date)

    return {"status": "generating", "review_date": review_date}


@router.post("/reviews/generate")
async def trigger_review_generation(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    review_date = yesterday()

    existing = (
        db.query(PetDailyReview)
        .filter(PetDailyReview.user_id == user_id, PetDailyReview.review_date == review_date)
        .first()
    )
    if existing:
        return {"status": "ready", "review": _review_to_dict(existing)}

    if not review_is_generating(user_id, review_date):
        _trigger_review_generation(user_id, review_date)

    return {"status": "generating", "review_date": review_date}


@router.post("/reviews/{review_date}/regenerate")
async def regenerate_review(review_date: str, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    if not _DATE_RE.match(review_date):
        raise HTTPException(400, detail="review_date must be YYYY-MM-DD")

    db.execute(
        _text(
            "DELETE FROM pet_daily_reviews WHERE user_id=:uid AND review_date=:dt"
        ),
        {"uid": user_id, "dt": review_date},
    )
    db.commit()

    _trigger_review_generation(user_id, review_date)
    return {"status": "generating", "review_date": review_date}
