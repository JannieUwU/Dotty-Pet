from datetime import datetime

from sqlalchemy import Column, Integer, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy import text
from .connection import Base
from app.crypto import EncryptedText


class User(Base):
    __tablename__ = "users"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    external_id = Column(Text, unique=True, nullable=True)   # frontend account id, e.g. "local-user@example.com"
    username    = Column(Text, nullable=False, default="User")
    email       = Column(Text)
    avatar_path = Column(Text)
    created_at  = Column(Text, nullable=False, server_default="(datetime('now'))")

    events         = relationship("Event",        back_populates="user", cascade="all, delete-orphan")
    goals          = relationship("Goal",         back_populates="user", cascade="all, delete-orphan")
    habits         = relationship("Habit",        back_populates="user", cascade="all, delete-orphan")
    focus_sessions = relationship("FocusSession", back_populates="user", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    title         = Column(EncryptedText, nullable=False)
    date          = Column(Text, nullable=False)          # YYYY-MM-DD
    start_time    = Column(Text)                          # HH:MM or NULL
    end_time      = Column(Text)
    color         = Column(Text, nullable=False, default="#83B5B5")
    has_countdown = Column(Integer, nullable=False, default=0)
    description   = Column(EncryptedText)
    created_at    = Column(Text, nullable=False, server_default="(datetime('now'))")
    updated_at    = Column(Text, nullable=False, server_default="(datetime('now'))")

    user = relationship("User", back_populates="events")


class Goal(Base):
    __tablename__ = "goals"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    year_month = Column(Text, nullable=False)             # YYYY-MM
    text       = Column(EncryptedText, nullable=False)
    completed  = Column(Integer, nullable=False, default=0)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(Text, nullable=False, server_default="(datetime('now'))")

    user = relationship("User", back_populates="goals")


class Habit(Base):
    __tablename__ = "habits"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    name        = Column(EncryptedText, nullable=False)
    icon        = Column(Text, nullable=False, default="📌")
    color       = Column(Text, nullable=False, default="#83B5B5")
    remind_time = Column(Text)                            # HH:MM or NULL
    days        = Column(Text, nullable=False, default="0,1,2,3,4,5,6")  # comma-separated 0=Mon
    is_active   = Column(Integer, nullable=False, default=1)
    sort_order  = Column(Integer, nullable=False, default=0)
    created_at  = Column(Text, nullable=False, server_default="(datetime('now'))")

    user   = relationship("User", back_populates="habits")
    checks = relationship("HabitCheck", back_populates="habit", cascade="all, delete-orphan")


class HabitCheck(Base):
    __tablename__ = "habit_checks"
    __table_args__ = (UniqueConstraint("habit_id", "check_date"),)
    id         = Column(Integer, primary_key=True, autoincrement=True)
    habit_id   = Column(Integer, ForeignKey("habits.id", ondelete="CASCADE"), nullable=False)
    check_date = Column(Text, nullable=False)             # YYYY-MM-DD
    checked_at = Column(Text, nullable=False, server_default="(datetime('now'))")

    habit = relationship("Habit", back_populates="checks")


class FocusSession(Base):
    __tablename__ = "focus_sessions"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    task_name    = Column(Text, nullable=False, default="")
    start_time   = Column(Text, nullable=False)
    end_time     = Column(Text, nullable=False)
    duration_min = Column(Integer, nullable=False)
    focus_min    = Column(Integer, nullable=False)
    break_min    = Column(Integer, nullable=False, default=5)
    completed    = Column(Integer, nullable=False, default=1)
    date         = Column(Text, nullable=False)           # YYYY-MM-DD

    user = relationship("User", back_populates="focus_sessions")


class ResourceFolder(Base):
    __tablename__ = "resource_folders"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    name       = Column(EncryptedText, nullable=False)
    color      = Column(Text, nullable=False, default="#83B5B5")
    created_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))

    files = relationship("ResourceFile", back_populates="folder", cascade="all, delete-orphan")


class ResourceFile(Base):
    __tablename__ = "resource_files"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    folder_id   = Column(Integer, ForeignKey("resource_folders.id", ondelete="CASCADE"), nullable=False)
    name        = Column(EncryptedText, nullable=False)
    file_type   = Column(Text, nullable=False)
    size_bytes  = Column(Integer, nullable=False, default=0)
    stored_path = Column(Text, nullable=False)   # absolute path on disk
    created_at  = Column(Text, nullable=False, server_default=text("(datetime('now'))"))

    folder = relationship("ResourceFolder", back_populates="files")


class Setting(Base):
    __tablename__ = "settings"
    __table_args__ = (UniqueConstraint("user_id", "key"),)
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    key        = Column(Text, nullable=False)
    value      = Column(Text, nullable=False)
    updated_at = Column(Text, nullable=False, server_default="(datetime('now'))")


class ChatMessage(Base):
    """Persists chat history between the user and Dotty."""
    __tablename__ = "chat_messages"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    role       = Column(Text, nullable=False)   # "user" | "assistant"
    content    = Column(EncryptedText, nullable=False)
    created_at = Column(Text, nullable=False, server_default="(datetime('now'))")


class PetDailyMemo(Base):
    """AI-generated daily summary memo based on yesterday's activity."""
    __tablename__ = "pet_daily_memos"
    __table_args__ = (UniqueConstraint("user_id", "memo_date"),)
    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    memo_date    = Column(Text, nullable=False)   # YYYY-MM-DD (the date being summarised)
    content      = Column(EncryptedText, nullable=False)
    generated_at = Column(Text, nullable=False, server_default="(datetime('now'))")


class PetPersonalityHistory(Base):
    """Audit log of every saved personality prompt (sanitised version only)."""
    __tablename__ = "pet_personality_history"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    content    = Column(EncryptedText, nullable=False)
    created_at = Column(Text, nullable=False, server_default="(datetime('now'))")


class PetDailyReview(Base):
    """AI-generated daily review based on yesterday's activity across all features."""
    __tablename__ = "pet_daily_reviews"
    __table_args__ = (UniqueConstraint("user_id", "review_date"),)
    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    review_date  = Column(Text, nullable=False)   # YYYY-MM-DD (the date being reviewed)
    rating       = Column(Integer, nullable=False)  # 1-5
    mood         = Column(Text, nullable=False)      # emoji
    title        = Column(EncryptedText, nullable=False)
    content      = Column(EncryptedText, nullable=False)
    generated_at = Column(Text, nullable=False, default=lambda: datetime.utcnow().isoformat())


class DashboardNote(Base):
    """User-written daily note shown on the dashboard. One note per day per user."""
    __tablename__ = "dashboard_notes"
    __table_args__ = (UniqueConstraint("user_id", "note_date"),)
    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, default=1)
    note_date  = Column(Text, nullable=False)   # YYYY-MM-DD
    content    = Column(EncryptedText, nullable=False, default="")
    updated_at = Column(Text, nullable=False, server_default="(datetime('now'))")
