from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from app.database.connection import get_db
from app.database.models import Event
from app.dependencies import get_current_user_id

router = APIRouter()


class EventIn(BaseModel):
    title: str
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    color: str = "#83B5B5"
    has_countdown: bool = False
    description: Optional[str] = None


class EventOut(EventIn):
    id: int
    class Config:
        from_attributes = True


@router.get("/", response_model=list[EventOut])
def list_events(month: Optional[str] = None, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    q = db.query(Event).filter(Event.user_id == user_id)
    if month:
        q = q.filter(Event.date.like(f"{month}%"))
    return q.order_by(Event.date, Event.start_time).all()


@router.post("/", response_model=EventOut, status_code=201)
def create_event(body: EventIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    data = body.model_dump()
    data['has_countdown'] = int(body.has_countdown)
    ev = Event(user_id=user_id, **data)
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@router.put("/{event_id}", response_model=EventOut)
def update_event(event_id: int, body: EventIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    ev = db.query(Event).filter(Event.id == event_id, Event.user_id == user_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    for k, v in body.model_dump().items():
        setattr(ev, k, int(v) if k == "has_countdown" else v)
    db.execute(text("UPDATE events SET updated_at = datetime('now') WHERE id = :id"), {"id": event_id})
    db.commit()
    db.refresh(ev)
    return ev


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    ev = db.query(Event).filter(Event.id == event_id, Event.user_id == user_id).first()
    if not ev:
        raise HTTPException(404, "Event not found")
    db.delete(ev)
    db.commit()
