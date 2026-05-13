import random
import string
import smtplib
import logging
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log = logging.getLogger(__name__)

router = APIRouter()

# In-memory store: { email_lower: { "code": str, "expires_at": datetime, "attempts": int } }
_code_store: dict[str, dict] = {}

SMTP_HOST = "smtp.qq.com"
SMTP_PORT = 465
SMTP_USER = "2018677403@qq.com"
SMTP_PASS = "bfivnajeogpbbfdc"

# Verification code settings
CODE_TTL_SECONDS = 120          # code valid for 2 minutes
MAX_VERIFY_ATTEMPTS = 5         # max wrong guesses before code is invalidated
MAX_SEND_PER_EMAIL = 3          # max sends per email within the rate window
SEND_RATE_WINDOW_SECONDS = 600  # 10-minute window for send rate limiting

# Per-email send rate limiting: { email_lower: [timestamp, ...] }
_send_log: dict[str, list[datetime]] = {}


def _generate_code(length: int = 6) -> str:
    """Generate a numeric-only OTP — easier to read and type than alphanumeric."""
    return "".join(random.choices(string.digits, k=length))


def _send_email(to_email: str, code: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Dotty verification code"
    msg["From"] = SMTP_USER
    msg["To"] = to_email

    ttl_minutes = CODE_TTL_SECONDS // 60
    body = (
        f"Your Dotty verification code is:\n\n"
        f"  {code}\n\n"
        f"It expires in {ttl_minutes} minutes. Do not share it with anyone."
    )
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, to_email, msg.as_string())


def _check_send_rate(email_lower: str) -> None:
    """Raise 429 if this email has exceeded the send rate limit."""
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=SEND_RATE_WINDOW_SECONDS)
    history = _send_log.get(email_lower, [])
    # Prune old entries
    history = [t for t in history if t > cutoff]
    if len(history) >= MAX_SEND_PER_EMAIL:
        raise HTTPException(
            status_code=429,
            detail=f"Too many code requests. Please wait a few minutes before trying again.",
        )
    history.append(now)
    _send_log[email_lower] = history


class SendCodeRequest(BaseModel):
    email: str


class VerifyCodeRequest(BaseModel):
    email: str
    code: str


@router.post("/send-code")
def send_code(body: SendCodeRequest):
    email_lower = body.email.strip().lower()
    if not email_lower or "@" not in email_lower:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    _check_send_rate(email_lower)

    code = _generate_code()
    expires_at = datetime.utcnow() + timedelta(seconds=CODE_TTL_SECONDS)
    # Overwrite any existing code — issuing a new one invalidates the old one
    _code_store[email_lower] = {"code": code, "expires_at": expires_at, "attempts": 0}

    try:
        _send_email(body.email.strip(), code)
    except Exception as exc:
        log.error("Failed to send verification email to %s: %s", body.email, exc)
        _code_store.pop(email_lower, None)
        raise HTTPException(status_code=502, detail="Failed to send verification email. Please try again.")

    log.info("Verification code sent to %s (expires in %ds)", email_lower, CODE_TTL_SECONDS)
    return {"detail": "Verification code sent."}


@router.post("/verify-code")
def verify_code(body: VerifyCodeRequest):
    email_lower = body.email.strip().lower()
    entry = _code_store.get(email_lower)

    if not entry:
        raise HTTPException(
            status_code=400,
            detail="No verification code found for this email. Please request a new one.",
        )

    if datetime.utcnow() > entry["expires_at"]:
        _code_store.pop(email_lower, None)
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired. Please request a new one.",
        )

    # Increment attempt counter before checking — prevents timing attacks
    entry["attempts"] += 1
    if entry["attempts"] > MAX_VERIFY_ATTEMPTS:
        _code_store.pop(email_lower, None)
        raise HTTPException(
            status_code=400,
            detail="Too many incorrect attempts. Please request a new verification code.",
        )

    if entry["code"] != body.code.strip():
        remaining = MAX_VERIFY_ATTEMPTS - entry["attempts"]
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect verification code. {remaining} attempt(s) remaining.",
        )

    # One-time use — delete after successful verification
    _code_store.pop(email_lower, None)
    log.info("Verification code verified for %s", email_lower)
    return {"detail": "Code verified."}
