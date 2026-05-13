from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database.connection import get_db
from app.database.models import FocusSession
from app.dependencies import get_current_user_id

router = APIRouter()


class FocusIn(BaseModel):
    task_name: str = ""
    start_time: str
    end_time: str
    duration_min: int
    focus_min: int
    break_min: int = 5
    completed: bool = True
    date: str


class FocusOut(FocusIn):
    id: int
    class Config:
        from_attributes = True


@router.get("/", response_model=list[FocusOut])
def list_sessions(date: Optional[str] = None, month: Optional[str] = None, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    q = db.query(FocusSession).filter(FocusSession.user_id == user_id)
    if date:
        q = q.filter(FocusSession.date == date)
    elif month:
        q = q.filter(FocusSession.date.like(f"{month}%"))
    return q.order_by(FocusSession.date.desc(), FocusSession.start_time.desc()).all()


@router.post("/", response_model=FocusOut, status_code=201)
def create_session(body: FocusIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    data = body.model_dump()
    data["completed"] = int(body.completed)
    session = FocusSession(user_id=user_id, **data)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    session = db.query(FocusSession).filter(FocusSession.id == session_id, FocusSession.user_id == user_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    db.delete(session)
    db.commit()
