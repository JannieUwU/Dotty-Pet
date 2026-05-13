"""
FastAPI dependencies for per-user data isolation.

Every request that touches user data must declare:
    user_id: int = Depends(get_current_user_id)

The frontend sends the account id in the X-User-ID header.
On first use the backend auto-creates a User row for that external id.
Guest / unauthenticated requests fall back to DEFAULT_USER_ID (user 1).
"""

import logging
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models import User
from app.config import DEFAULT_USER_ID

log = logging.getLogger(__name__)

_HEADER = "x-user-id"


def get_current_user_id(request: Request, db: Session = Depends(get_db)) -> int:
    """
    Resolve the integer user_id for the current request.

    1. Read the X-User-ID header (the frontend account id string).
    2. Look up User.external_id == header value.
    3. If not found, create a new User row (auto-provision on first login).
    4. If no header is present, fall back to DEFAULT_USER_ID (user 1).
    """
    external_id = request.headers.get(_HEADER, "").strip()

    if not external_id:
        return DEFAULT_USER_ID

    user = db.query(User).filter(User.external_id == external_id).first()
    if user:
        return user.id

    # Auto-provision: first time this account touches the backend
    user = User(external_id=external_id, username="User")
    db.add(user)
    db.commit()
    db.refresh(user)
    log.info("Auto-provisioned user %d for external_id=%s", user.id, external_id)
    return user.id
