from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database.connection import get_db
from app.database.models import Habit, HabitCheck
from app.dependencies import get_current_user_id

router = APIRouter()


class HabitIn(BaseModel):
    name: str
    icon: str = "📌"
    color: str = "#83B5B5"
    remind_time: Optional[str] = None
    days: str = "0,1,2,3,4,5,6"
    sort_order: int = 0


class HabitOut(HabitIn):
    id: int
    is_active: int
    class Config:
        from_attributes = True


class CheckOut(BaseModel):
    habit_id: int
    check_date: str
    class Config:
        from_attributes = True


@router.get("/", response_model=list[HabitOut])
def list_habits(db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    return db.query(Habit).filter(Habit.user_id == user_id, Habit.is_active == 1).order_by(Habit.sort_order, Habit.id).all()


@router.post("/", response_model=HabitOut, status_code=201)
def create_habit(body: HabitIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    habit = Habit(user_id=user_id, **body.model_dump())
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


@router.put("/{habit_id}", response_model=HabitOut)
def update_habit(habit_id: int, body: HabitIn, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(404, "Habit not found")
    for k, v in body.model_dump().items():
        setattr(habit, k, v)
    db.commit()
    db.refresh(habit)
    return habit


@router.delete("/{habit_id}", status_code=204)
def delete_habit(habit_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(404, "Habit not found")
    db.query(HabitCheck).filter(HabitCheck.habit_id == habit_id).delete()
    db.delete(habit)
    db.commit()


class HabitUpdate(BaseModel):
    days: str
    remind_time: Optional[str] = None


@router.patch("/{habit_id}", response_model=HabitOut)
def patch_habit(habit_id: int, body: HabitUpdate, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(404, "Habit not found")
    habit.days = body.days
    habit.remind_time = body.remind_time
    db.commit()
    db.refresh(habit)
    return habit


@router.post("/{habit_id}/check", response_model=CheckOut, status_code=201)
def check_habit(habit_id: int, date: str, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(404, "Habit not found")
    existing = db.query(HabitCheck).filter(HabitCheck.habit_id == habit_id, HabitCheck.check_date == date).first()
    if existing:
        return existing
    check = HabitCheck(habit_id=habit_id, check_date=date)
    db.add(check)
    db.commit()
    db.refresh(check)
    return check


@router.delete("/{habit_id}/check", status_code=204)
def uncheck_habit(habit_id: int, date: str, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(404, "Habit not found")
    check = db.query(HabitCheck).filter(HabitCheck.habit_id == habit_id, HabitCheck.check_date == date).first()
    if check:
        db.delete(check)
        db.commit()


@router.get("/checks", response_model=list[CheckOut])
def get_checks(from_date: Optional[str] = None, to_date: Optional[str] = None, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    habit_ids = [h.id for h in db.query(Habit.id).filter(Habit.user_id == user_id).all()]
    q = db.query(HabitCheck).filter(HabitCheck.habit_id.in_(habit_ids))
    if from_date:
        q = q.filter(HabitCheck.check_date >= from_date)
    if to_date:
        q = q.filter(HabitCheck.check_date <= to_date)
    return q.all()
