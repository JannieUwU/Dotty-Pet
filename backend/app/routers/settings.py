from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from app.database.connection import get_db
from app.database.models import (
    Setting, PetDailyReview, PetDailyMemo, ChatMessage, DashboardNote
)
from app.dependencies import get_current_user_id

router = APIRouter()

DEFAULTS = {
    "ai_provider":           "ollama",
    "ai_model":              "qwen2.5",
    "pomodoro_focus":        "25",
    "pomodoro_break":        "5",
    "pomodoro_long_break":   "15",
    "auto_break":            "0",
    "auto_focus":            "0",
    "theme":                 "light",
    "language":              "en",
    "data_retention_months": "3",
    "clear_resources_on_logout": "0",
}

# Keys that may be written via the API.
ALLOWED_KEYS = set(DEFAULTS.keys())

# Tables pruned by the retention policy and their date column names.
_PRUNABLE = [
    (PetDailyReview, "review_date"),
    (PetDailyMemo,   "memo_date"),
    (ChatMessage,    "created_at"),
    (DashboardNote,  "note_date"),
]


def _cutoff_date(months: int) -> str:
    """Return the ISO cutoff date string (records *before* this date are removed)."""
    today = date.today()
    year  = today.year  - (months // 12)
    month = today.month - (months % 12)
    if month <= 0:
        month += 12
        year  -= 1
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    cutoff = date(year, month, min(today.day, last_day))
    return cutoff.isoformat()


def run_prune(db: Session, user_id: int, months: int) -> dict:
    """Delete records older than *months* months for a specific user."""
    cutoff = _cutoff_date(months)
    counts: dict[str, int] = {}
    for model, date_col in _PRUNABLE:
        result = db.execute(
            text(f"DELETE FROM {model.__tablename__} WHERE user_id=:uid AND {date_col} < :cutoff"),
            {"uid": user_id, "cutoff": cutoff},
        )
        counts[model.__tablename__] = result.rowcount
    db.commit()
    return counts


class SettingsUpdate(BaseModel):
    data: dict[str, str]


@router.get("/")
def get_settings(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    rows = db.query(Setting).filter(Setting.user_id == user_id).all()
    result = dict(DEFAULTS)
    for row in rows:
        result[row.key] = row.value
    return result


@router.put("/")
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    for key, value in body.data.items():
        if key not in ALLOWED_KEYS:
            raise HTTPException(400, f"Unknown setting key: {key}")
        if key == "data_retention_months" and value not in {"1", "3", "6", "12"}:
            raise HTTPException(400, "data_retention_months must be 1, 3, 6, or 12")
        if key == "clear_resources_on_logout" and value not in {"0", "1"}:
            raise HTTPException(400, "clear_resources_on_logout must be 0 or 1")
        existing = db.query(Setting).filter(Setting.user_id == user_id, Setting.key == key).first()
        if existing:
            existing.value = value
        else:
            db.add(Setting(user_id=user_id, key=key, value=value))
    db.commit()
    return {"ok": True}


@router.post("/prune")
def prune_data(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """Immediately prune all data older than the current retention window."""
    row = db.query(Setting).filter(Setting.user_id == user_id, Setting.key == "data_retention_months").first()
    months = int(row.value) if row else 3
    counts = run_prune(db, user_id, months)
    total  = sum(counts.values())
    return {
        "ok":     True,
        "months": months,
        "cutoff": _cutoff_date(months),
        "deleted": counts,
        "total_deleted": total,
    }
