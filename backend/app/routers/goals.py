from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database.connection import get_db
from app.database.models import Goal
from app.dependencies import get_current_user_id

router = APIRouter()


class GoalIn(BaseModel):
    year_month: str
    text: str
    completed: bool = False
    sort_order: int = 0


class GoalOut(GoalIn):
    id: int
    class Config:
        from_attributes = True


@router.get("/", response_model=list[GoalOut])
def list_goals(month: Optional[str] = None, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    q = db.query(Goal).filter(Goal.user_id == user_id)
    if month:
        q = q.filter(Goal.year_month == month)
    return q.order_by(Goal.sort_order, Goal.id).all()


@router.post("/", response_model=GoalOut, status_code=201)
def create_goal(body: GoalIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    data = body.model_dump()
    data['completed'] = int(body.completed)
    goal = Goal(user_id=user_id, **data)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.patch("/{goal_id}/toggle", response_model=GoalOut)
def toggle_goal(goal_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(404, "Goal not found")
    goal.completed = 0 if goal.completed else 1
    db.commit()
    db.refresh(goal)
    return goal


@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, body: GoalIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(404, "Goal not found")
    for k, v in body.model_dump().items():
        setattr(goal, k, int(v) if k == "completed" else v)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(404, "Goal not found")
    db.delete(goal)
    db.commit()
