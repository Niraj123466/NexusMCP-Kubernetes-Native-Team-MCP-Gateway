"""
API Keys router.

Endpoints:
  POST   /api/keys              issue a new key (any authenticated user for themselves; admin for any user)
  GET    /api/keys              list own keys (or all keys for admin)
  DELETE /api/keys/{id}         revoke a key (owner or admin)

Security notes:
  - Plaintext key returned ONLY in the POST response body.
  - key_hash is NEVER returned to any client.
  - Only the prefix is exposed in list/get responses.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.api_keys import generate_api_key, utcnow
from gateway.auth.deps import get_current_user, require_admin
from gateway.db.models import ApiKey, User, UserRole
from gateway.db.session import get_db

router = APIRouter(prefix="/api/keys", tags=["api-keys"])


# ── Schemas ───────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, description="Human-readable label")
    user_id: uuid.UUID | None = Field(
        None, description="Target user (admin only). Defaults to caller."
    )


class ApiKeyCreated(BaseModel):
    """Returned once only — contains the plaintext key."""
    id: uuid.UUID
    name: str
    prefix: str
    key: str   # plaintext — show once and discard
    user_id: uuid.UUID
    created_at: datetime


class ApiKeyInfo(BaseModel):
    """Safe representation — no plaintext key, no hash."""
    id: uuid.UUID
    name: str
    prefix: str
    user_id: uuid.UUID
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None
    is_active: bool

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────

@router.post("", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
async def issue_key(
    body: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiKeyCreated:
    """
    Issue a new API key.

    - Members can only issue keys for themselves.
    - Admins can issue keys for any user by providing user_id.
    """
    target_user_id = body.user_id or current_user.id

    # Non-admins cannot issue keys for other users
    if current_user.role != UserRole.admin and target_user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot issue keys for other users.")

    # Verify target user exists
    target_user = await db.get(User, target_user_id)
    if target_user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Target user not found.")
    if not target_user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot issue key for inactive user.")

    plaintext, key_hash, prefix = generate_api_key()

    api_key = ApiKey(
        user_id=target_user_id,
        name=body.name,
        prefix=prefix,
        key_hash=key_hash,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return ApiKeyCreated(
        id=api_key.id,
        name=api_key.name,
        prefix=api_key.prefix,
        key=plaintext,  # only time plaintext is returned
        user_id=target_user_id,
        created_at=api_key.created_at,
    )


@router.get("", response_model=list[ApiKeyInfo])
async def list_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ApiKey]:
    """List API keys. Admins see all keys; members see only their own."""
    query = select(ApiKey).order_by(ApiKey.created_at.desc())
    if current_user.role != UserRole.admin:
        query = query.where(ApiKey.user_id == current_user.id)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_key(
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Revoke an API key immediately.

    Owners can revoke their own keys; admins can revoke any key.
    """
    api_key = await db.get(ApiKey, key_id)
    if api_key is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Key not found.")

    if current_user.role != UserRole.admin and api_key.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot revoke another user's key.")

    if api_key.revoked_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Key is already revoked.")

    api_key.revoked_at = utcnow()
    await db.commit()
