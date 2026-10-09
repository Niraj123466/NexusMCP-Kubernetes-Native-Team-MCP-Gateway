"""FastAPI dependency functions for authentication and authorisation."""
from __future__ import annotations

from datetime import timezone

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.api_keys import utcnow, verify_api_key
from gateway.db.models import ApiKey, User, UserRole
from gateway.db.session import get_db

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=True)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or revoked API key.",
    headers={"WWW-Authenticate": "ApiKey"},
)
_FORBIDDEN = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Admin privileges required.",
)


async def get_current_user(
    raw_key: str = Security(_api_key_header),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate X-API-Key header and return the authenticated User.

    Steps:
    1. Extract the key prefix (first 8 chars) to narrow the DB lookup.
    2. Load all non-revoked ApiKey rows matching that prefix.
    3. Bcrypt-verify the plaintext against each candidate hash.
    4. Confirm the key is not revoked and the user is active.
    5. Touch last_used_at.

    Identity is ALWAYS resolved from the DB — never from client-supplied claims.
    """
    if not raw_key or len(raw_key) < 8:
        raise _UNAUTHORIZED

    prefix = raw_key[:8]

    # Load matching, non-revoked keys (tiny result set due to prefix index)
    result = await db.execute(
        select(ApiKey)
        .options(selectinload(ApiKey.user))
        .where(ApiKey.prefix == prefix, ApiKey.revoked_at.is_(None))
        .join(ApiKey.user)
        .where(User.is_active.is_(True))
    )
    candidates: list[ApiKey] = list(result.scalars().all())

    matched_key: ApiKey | None = None
    for candidate in candidates:
        if verify_api_key(raw_key, candidate.key_hash):
            matched_key = candidate
            break

    if matched_key is None:
        raise _UNAUTHORIZED

    # Touch last_used_at (best-effort — don't fail if this write fails)
    try:
        matched_key.last_used_at = utcnow()
        await db.commit()
    except Exception:  # noqa: BLE001
        await db.rollback()

    user: User = matched_key.user
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Dependency that additionally enforces the admin role."""
    if user.role != UserRole.admin:
        raise _FORBIDDEN
    return user
