"""
/dashboard — Dashboard API

Endpoints:
  GET  /dashboard/notes/{date}   Return note for a specific date (YYYY-MM-DD)
  PUT  /dashboard/notes/{date}   Upsert note for a specific date
  GET  /dashboard/notes          Return all notes (newest first, max 90 days)
"""

import re
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import DashboardNote
from app.dependencies import get_current_user_id

log = logging.getLogger(__name__)
router = APIRouter()

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_NOTE_LEN = 2000


def _validate_date(date_str: str):
    if not _DATE_RE.match(date_str):
        raise HTTPException(400, detail="date must be YYYY-MM-DD")


def _note_to_dict(n: DashboardNote) -> dict:
    return {
        "date": n.note_date,
        "content": n.content,
        "updated_at": n.updated_at,
    }


# ── GET single note ───────────────────────────────────────────────────────────

@router.get("/notes/{note_date}")
def get_note(note_date: str, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    _validate_date(note_date)
    row = (
        db.query(DashboardNote)
        .filter(DashboardNote.user_id == user_id, DashboardNote.note_date == note_date)
        .first()
    )
    if not row:
        return {"date": note_date, "content": "", "updated_at": None}
    return _note_to_dict(row)


# ── PUT upsert note ───────────────────────────────────────────────────────────

class NoteIn(BaseModel):
    content: str


@router.put("/notes/{note_date}")
def upsert_note(note_date: str, body: NoteIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    _validate_date(note_date)
    content = body.content[:MAX_NOTE_LEN]

    row = (
        db.query(DashboardNote)
        .filter(DashboardNote.user_id == user_id, DashboardNote.note_date == note_date)
        .first()
    )
    if row:
        row.content = content
        row.updated_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
    else:
        db.add(DashboardNote(user_id=user_id, note_date=note_date, content=content))
    db.commit()
    log.info("dashboard note upserted for %s (len=%d)", note_date, len(content))
    return {"ok": True, "date": note_date, "updated_at": "now"}


# ── GET all notes (for date picker / history) ─────────────────────────────────

@router.get("/notes")
def list_notes(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    """Return all non-empty notes, newest first."""
    rows = (
        db.query(DashboardNote)
        .filter(
            DashboardNote.user_id == user_id,
            DashboardNote.content != "",
        )
        .order_by(DashboardNote.note_date.desc())
        .all()
    )
    return {"notes": [_note_to_dict(r) for r in rows]}
