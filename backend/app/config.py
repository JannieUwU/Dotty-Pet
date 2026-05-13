"""
Central configuration constants for the DottyPet backend.

All magic numbers that appear in multiple files should be defined here.
Import with:  from app.config import DEFAULT_USER_ID, BACKEND_PORT, ...
"""

# ── Application ports ──────────────────────────────────────────────────────────
BACKEND_PORT: int = 8766
UNITY_PORT: int = 8765

# ── Single-user identity ───────────────────────────────────────────────────────
# DottyPet is a single-user desktop app.  All data belongs to this user.
# Centralised here so a future multi-user migration only needs one change.
DEFAULT_USER_ID: int = 1

# ── AI backend ────────────────────────────────────────────────────────────────
AI_CONNECT_TIMEOUT: float = 10.0
AI_READ_TIMEOUT: float = 120.0
AI_WRITE_TIMEOUT: float = 10.0
AI_POOL_TIMEOUT: float = 10.0
AI_DEFAULT_MODEL: str = "qwen2.5"
AI_DEFAULT_PROVIDER: str = "ollama"

# ── VRM model loading ─────────────────────────────────────────────────────────
MAX_VRM_SIZE_MB: int = 500

# ── Personality prompt ────────────────────────────────────────────────────────
PERSONALITY_MAX_CHARS: int = 500

# ── Data retention ────────────────────────────────────────────────────────────
DEFAULT_RETENTION_MONTHS: int = 3

# ── Resource library storage ───────────────────────────────────────────────────
import os as _os
RESOURCES_BASE_DIR: str = _os.path.abspath(
    _os.path.join(_os.path.dirname(__file__), "../../data/resources")
)
