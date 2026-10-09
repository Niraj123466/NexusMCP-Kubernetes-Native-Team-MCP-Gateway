"""
API key generation, hashing, and validation.

Security guarantees:
- Keys generated with secrets.token_urlsafe(32) — 256 bits of entropy.
- Stored as bcrypt hash; plaintext is never persisted.
- Prefix (first 8 chars of the 'nexus_' + raw token) stored for UI identification.
- Revocation is immediate — revoked_at is set and checked on every request.
- Keys are never logged; only the prefix appears in audit entries.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone

import bcrypt

# All NexusMCP keys start with this prefix so they are recognisable at a glance.
_KEY_PREFIX = "nexus_"
_KEY_BYTES = 32  # 256 bits → 43 base64url chars


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.

    Returns:
        (plaintext_key, key_hash, prefix)
        - plaintext_key: show to user exactly once, then discard
        - key_hash: store in DB
        - prefix: first 8 chars of plaintext_key (after 'nexus_'), safe to log/display
    """
    raw = secrets.token_urlsafe(_KEY_BYTES)
    plaintext = f"{_KEY_PREFIX}{raw}"
    prefix = plaintext[:8]
    key_hash = _hash_key(plaintext)
    return plaintext, key_hash, prefix


def _hash_key(plaintext: str) -> str:
    """Bcrypt-hash an API key. Uses work factor 12."""
    return bcrypt.hashpw(plaintext.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_api_key(plaintext: str, stored_hash: str) -> bool:
    """
    Constant-time bcrypt comparison.

    Returns True if the plaintext matches the stored hash.
    Never raises — returns False on any error.
    """
    try:
        return bcrypt.checkpw(plaintext.encode(), stored_hash.encode())
    except Exception:  # noqa: BLE001
        return False


def hash_args(args: dict, secret: str) -> str:
    """
    HMAC-SHA256 of the JSON-serialised tool arguments.

    Used in audit logs to allow integrity verification without storing PII.
    The gateway secret key is used as the HMAC key.
    """
    payload = json.dumps(args, sort_keys=True, ensure_ascii=False).encode()
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)
