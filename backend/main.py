from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import logging
import os
import uvicorn

from app.routers import chat, system, git_monitor
from app.routers import events, goals, habits, focus, settings, resources, menu, chat_history, pet, dashboard
from app.routers.auth import router as auth_router
from app.services.ws_server import router as ws_router
from app.database.connection import engine
from app.database import models
from app.config import BACKEND_PORT

# Create all tables on startup
models.Base.metadata.create_all(bind=engine)

# Schema migrations — ALTER TABLE for columns added after initial release
from app.database.connection import SessionLocal
from app.database.models import User, Setting
from app.config import DEFAULT_USER_ID
from sqlalchemy import text as _text

def _migrate_schema():
    """
    Idempotent schema migrations for databases created before recent model changes.
    Runs via raw SQLite so it works even when SQLAlchemy ORM queries would fail.
    """
    import sqlite3
    from app.database.connection import DATABASE_URL
    db_path = DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 1. users: add external_id if missing
    cur.execute("PRAGMA table_info(users)")
    user_cols = {r[1] for r in cur.fetchall()}
    if "external_id" not in user_cols:
        cur.execute("ALTER TABLE users ADD COLUMN external_id TEXT")
        logging.getLogger(__name__).info("Schema migration: added users.external_id")

    # 2. settings: rebuild if old schema (no user_id column)
    cur.execute("PRAGMA table_info(settings)")
    setting_cols = {r[1] for r in cur.fetchall()}
    if "user_id" not in setting_cols:
        # Save existing rows
        cur.execute("SELECT key, value, updated_at FROM settings")
        old_rows = cur.fetchall()
        # Drop old table and let create_all rebuild it with new schema
        cur.execute("DROP TABLE settings")
        conn.commit()
        conn.close()
        # Recreate with new schema via SQLAlchemy
        models.Base.metadata.tables["settings"].create(bind=engine)
        # Re-insert old rows under DEFAULT_USER_ID
        db = SessionLocal()
        try:
            for key, value, updated_at in old_rows:
                db.execute(
                    _text("INSERT OR IGNORE INTO settings (user_id, key, value, updated_at) "
                          "VALUES (:uid, :k, :v, :u)"),
                    {"uid": DEFAULT_USER_ID, "k": key, "v": value, "u": updated_at},
                )
            db.commit()
        finally:
            db.close()
        logging.getLogger(__name__).info(
            "Schema migration: rebuilt settings table with user_id, migrated %d rows", len(old_rows)
        )
        return  # conn already closed

    conn.commit()
    conn.close()

_migrate_schema()

# Seed default user if not exists
def _seed():
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.id == DEFAULT_USER_ID).first():
            db.add(User(id=DEFAULT_USER_ID, username="User"))
        defaults = {
            "ai_provider": "ollama", "ai_model": "qwen2.5",
            "pomodoro_focus": "25", "pomodoro_break": "5",
            "pomodoro_long_break": "15", "auto_break": "0",
            "auto_focus": "0", "theme": "light",
            "data_retention_months": "3",
            "clear_resources_on_logout": "0",
        }
        for k, v in defaults.items():
            db.execute(
                _text("INSERT OR IGNORE INTO settings (user_id, key, value, updated_at) "
                      "VALUES (:uid, :k, :v, datetime('now'))"),
                {"uid": DEFAULT_USER_ID, "k": k, "v": v}
            )
        # Force-update AI provider/model to ollama regardless of existing value
        for k, v in [("ai_provider", "ollama"), ("ai_model", "qwen2.5")]:
            db.execute(
                _text("UPDATE settings SET value=:v, updated_at=datetime('now') "
                      "WHERE user_id=:uid AND key=:k"),
                {"uid": DEFAULT_USER_ID, "k": k, "v": v}
            )
        db.commit()
    finally:
        db.close()
_seed()


def _migrate_resources():
    """
    One-time migration: data/resources/{folder_id}/ → data/resources/1/{folder_id}/
    Idempotent: returns immediately if user_dir already exists.
    Uses a temp directory to avoid self-move collision (folder_id=1 vs user_id=1).
    """
    import shutil as _shutil
    from app.config import RESOURCES_BASE_DIR, DEFAULT_USER_ID
    from app.database.models import ResourceFile, ResourceFolder as _RF

    base = RESOURCES_BASE_DIR
    user_dir = os.path.join(base, str(DEFAULT_USER_ID))

    if os.path.exists(user_dir):
        return  # already migrated

    db = SessionLocal()
    try:
        folders = db.query(_RF).filter(_RF.user_id == DEFAULT_USER_ID).all()
        folder_ids = {str(f.id) for f in folders}

        tmp_dir = base + "_mig_tmp"
        os.makedirs(tmp_dir, exist_ok=True)

        # Move each folder subdirectory to tmp
        for fid in folder_ids:
            src = os.path.join(base, fid)
            if os.path.exists(src):
                _shutil.move(src, os.path.join(tmp_dir, fid))

        # Move thumbs to tmp
        old_thumbs = os.path.join(base, "thumbs")
        if os.path.exists(old_thumbs):
            _shutil.move(old_thumbs, os.path.join(tmp_dir, "thumbs"))

        # Rename tmp → user_dir
        os.rename(tmp_dir, user_dir)

        # Update stored_path in DB
        all_files = (
            db.query(ResourceFile)
            .join(_RF, ResourceFile.folder_id == _RF.id)
            .filter(_RF.user_id == DEFAULT_USER_ID)
            .all()
        )
        for f in all_files:
            if f.stored_path.startswith(base + os.sep) or f.stored_path.startswith(base + "/"):
                rel = f.stored_path[len(base):].lstrip("/\\")
                f.stored_path = os.path.join(user_dir, rel)

        db.commit()
        logging.getLogger(__name__).info("Resource migration completed → %s", user_dir)
    except Exception as e:
        db.rollback()
        logging.getLogger(__name__).error("Resource migration failed: %s", e)
        tmp = base + "_mig_tmp"
        if os.path.exists(tmp):
            _shutil.rmtree(tmp, ignore_errors=True)
    finally:
        db.close()


_migrate_resources()


def _migrate_encrypt_fields():
    """Encrypt all plaintext sensitive fields in-place. Idempotent."""
    from app.crypto import _PREFIX
    from app.database.models import (
        Event, Goal, Habit, ChatMessage,
        PetDailyMemo, PetPersonalityHistory, PetDailyReview,
        DashboardNote, ResourceFolder, ResourceFile,
    )
    SENSITIVE = [
        (Event,                ["title", "description"]),
        (Goal,                 ["text"]),
        (Habit,                ["name"]),
        (ChatMessage,          ["content"]),
        (PetDailyMemo,         ["content"]),
        (PetPersonalityHistory,["content"]),
        (PetDailyReview,       ["title", "content"]),
        (DashboardNote,        ["content"]),
        (ResourceFolder,       ["name"]),
        (ResourceFile,         ["name"]),
    ]
    db = SessionLocal()
    try:
        for Model, fields in SENSITIVE:
            for row in db.query(Model).all():
                for field in fields:
                    val = getattr(row, field, None)
                    if val and not val.startswith(_PREFIX):
                        setattr(row, field, val)  # triggers TypeDecorator encrypt
        db.commit()
        logging.getLogger(__name__).info("Field encryption migration completed.")
    finally:
        db.close()


_migrate_encrypt_fields()

app = FastAPI(title="Dotty Pet Backend", version="1.0.0")

log = logging.getLogger(__name__)


@app.exception_handler(Exception)
async def _global_exception_handler(request, exc: Exception):
    """Catch-all handler: log the full traceback, return a generic 500.
    Prevents internal details (file paths, stack traces) from leaking to clients.
    """
    log.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "app://.",                # Electron production (file protocol)
        "file://",                # Electron fallback
    ],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-User-ID"],
)

app.include_router(chat.router,       prefix="/chat",           tags=["chat"])
app.include_router(system.router,     prefix="/system",         tags=["system"])
app.include_router(git_monitor.router,prefix="/git",            tags=["git"])
app.include_router(events.router,     prefix="/events",         tags=["events"])
app.include_router(goals.router,      prefix="/goals",          tags=["goals"])
app.include_router(habits.router,     prefix="/habits",         tags=["habits"])
app.include_router(focus.router,      prefix="/focus-sessions", tags=["focus"])
app.include_router(settings.router,   prefix="/settings",       tags=["settings"])
app.include_router(resources.router,  prefix="/resources",      tags=["resources"])
app.include_router(menu.router,                                  tags=["menu"])
app.include_router(chat_history.router, prefix="/chat-history",  tags=["chat-history"])
app.include_router(pet.router,          prefix="/pet",            tags=["pet"])
app.include_router(dashboard.router,    prefix="/dashboard",      tags=["dashboard"])
app.include_router(auth_router,         prefix="/auth",            tags=["auth"])
app.include_router(ws_router, tags=["websocket"])

@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Startup / shutdown lifecycle ──────────────────────────────────────────────

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.memo_generator import ensure_yesterday_memo as ensure_memo
from app.services.review_generator import ensure_yesterday_review as ensure_review
from app.routers.settings import run_prune as _run_prune
from app.services.ai_service import close_backend
from app.services.ws_server import close_all_clients

_scheduler = AsyncIOScheduler()


async def _daily_prune():
    """Run retention pruning using the current setting value."""
    db = SessionLocal()
    try:
        from app.database.models import Setting as _Setting
        row = db.query(_Setting).filter(_Setting.key == "data_retention_months").first()
        months = int(row.value) if row else 3
        _run_prune(db, months)
    finally:
        db.close()


@app.on_event("startup")
async def _startup():
    # Backfill yesterday's memo and review in parallel — don't block startup
    await asyncio.gather(
        ensure_memo(DEFAULT_USER_ID),
        ensure_review(DEFAULT_USER_ID),
        return_exceptions=True,  # one failure doesn't abort the other
    )

    # Schedule daily generation at 00:01
    _scheduler.add_job(ensure_memo,    "cron", hour=0, minute=1, args=[DEFAULT_USER_ID])
    _scheduler.add_job(ensure_review,  "cron", hour=0, minute=1, args=[DEFAULT_USER_ID])
    # Schedule daily retention prune at 00:05
    _scheduler.add_job(_daily_prune,   "cron", hour=0, minute=5)
    _scheduler.start()


@app.on_event("shutdown")
async def _shutdown():
    # 1. Stop scheduler — no new jobs will fire
    if _scheduler.running:
        _scheduler.shutdown(wait=False)

    # 2. Cancel all in-flight asyncio tasks (memo/review generation, etc.)
    #    Skip the current task (the shutdown handler itself).
    try:
        current = asyncio.current_task()
        pending = [t for t in asyncio.all_tasks() if t is not current and not t.done()]
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
    except BaseException:
        pass

    # 3. Close all active WebSocket connections gracefully
    try:
        await close_all_clients()
    except BaseException:
        pass

    # 4. Close the shared httpx client used for Ollama calls
    try:
        await close_backend()
    except BaseException:
        pass

    log.info("Shutdown complete — all resources released.")


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=BACKEND_PORT, reload=False)

