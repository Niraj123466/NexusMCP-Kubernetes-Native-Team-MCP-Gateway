"""Audit log viewer router."""
from __future__ import annotations

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.deps import get_current_user, require_admin
from gateway.db.models import AuditLog, User, UserRole
from gateway.db.session import get_db

router = APIRouter(prefix="/api/audit", tags=["audit"])


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    upstream_id: uuid.UUID | None
    tool_name: str
    args_hash: str
    duration_ms: int | None
    outcome: str
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    user: User = Depends(get_current_user),
    user_id: uuid.UUID | None = None,
    outcome: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLog]:
    """
    List audit log entries.
    Admins can view all entries and filter by user_id.
    Members can only see their own tool call logs.
    """
    query = select(AuditLog).order_by(AuditLog.created_at.desc())

    if user.role != UserRole.admin:
        query = query.where(AuditLog.user_id == user.id)
    elif user_id:
        query = query.where(AuditLog.user_id == user_id)

    if outcome:
        query = query.where(AuditLog.outcome == outcome)

    query = query.offset(offset).limit(limit)
    res = await db.execute(query)
    return list(res.scalars().all())
