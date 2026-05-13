"""Chat history router — persist and retrieve Dotty chat messages."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.models import ChatMessage
from app.dependencies import get_current_user_id

router = APIRouter()

# Keep at most this many messages in DB — oldest are pruned on each save
MAX_HISTORY = 200


class MessageIn(BaseModel):
    role: str
    content: str

    @field_validator('role')
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        if v not in ('user', 'assistant'):
            raise ValueError("role must be 'user' or 'assistant'")
        return v


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: str

    class Config:
        from_attributes = True


@router.get("/", response_model=list[MessageOut])
def get_history(limit: int = 100, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.id.asc())
        .limit(limit)
        .all()
    )
    return rows


@router.post("/", response_model=MessageOut, status_code=201)
def save_message(body: MessageIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    msg = ChatMessage(user_id=user_id, role=body.role, content=body.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Prune oldest messages if over limit
    total = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).count()
    if total > MAX_HISTORY:
        ids = [
            r.id for r in (
                db.query(ChatMessage.id)
                .filter(ChatMessage.user_id == user_id)
                .order_by(ChatMessage.id.asc())
                .limit(total - MAX_HISTORY)
                .all()
            )
        ]
        db.query(ChatMessage).filter(ChatMessage.id.in_(ids)).delete(synchronize_session=False)
        db.commit()

    return msg


@router.delete("/")
def clear_history(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    db.query(ChatMessage).filter(ChatMessage.user_id == user_id).delete()
    db.commit()
    return {"ok": True}
