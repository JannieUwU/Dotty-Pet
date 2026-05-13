"""
Application-layer field encryption for sensitive database columns.

Key derivation:
  - Source: platform.node() (hostname) as machine identifier
  - Algorithm: PBKDF2HMAC-SHA256, 100 000 iterations, fixed salt
  - Output: 32 bytes → urlsafe-base64 → Fernet key
  - Derived once at module load, kept in memory only

Encryption format:
  - Stored value: "enc:" + Fernet token (urlsafe-base64)
  - Plain values (no "enc:" prefix) are returned as-is for backward compatibility
"""

import base64
import platform

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

# ── Key derivation ─────────────────────────────────────────────────────────────

_SALT = b"dotty-pet-v1"
_PREFIX = "enc:"


def _derive_key() -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_SALT,
        iterations=100_000,
    )
    raw = kdf.derive(platform.node().encode())
    return base64.urlsafe_b64encode(raw)


_fernet = Fernet(_derive_key())


# ── Encrypt / decrypt helpers ──────────────────────────────────────────────────

def encrypt(value: str) -> str:
    """Return enc:<fernet-token> for the given plaintext string."""
    return _PREFIX + _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    """Decrypt an enc:-prefixed value; return plain values unchanged."""
    if value.startswith(_PREFIX):
        return _fernet.decrypt(value[len(_PREFIX):].encode()).decode()
    return value


# ── SQLAlchemy TypeDecorator ───────────────────────────────────────────────────

class EncryptedText(TypeDecorator):
    """Transparent encrypt-on-write / decrypt-on-read column type."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if not value:
            return value
        if value.startswith(_PREFIX):
            return value  # already encrypted
        return encrypt(value)

    def process_result_value(self, value, dialect):
        if not value:
            return value
        return decrypt(value)
