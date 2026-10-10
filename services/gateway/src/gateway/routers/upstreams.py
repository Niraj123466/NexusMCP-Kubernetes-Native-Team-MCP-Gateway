"""Upstream MCP servers management router."""
from __future__ import annotations

import time
import uuid
from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from gateway.auth.deps import require_admin
from gateway.db.models import UpstreamAuthType, UpstreamServer, User
from gateway.db.session import get_db
from gateway.mcp.aggregator import aggregator
from gateway.mcp.crypto import encrypt_credential
from gateway.mcp.ssrf_guard import GatewaySSRFError, validate_upstream_url

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/upstreams", tags=["upstreams"])


# ── Schemas ───────────────────────────────────────────────────

class UpstreamCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9_-]+$")
    name: str = Field(..., min_length=2, max_length=128)
    url: str = Field(...)
    description: str = Field("", max_length=1000)
    auth_type: UpstreamAuthType = UpstreamAuthType.none
    auth_header_name: str | None = None
    auth_token: str | None = Field(None, description="Plaintext token/credential, will be encrypted at rest")
    enabled: bool = True
    timeout_seconds: int = Field(30, ge=1, le=300)


class UpstreamUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    description: str | None = None
    auth_type: UpstreamAuthType | None = None
    auth_header_name: str | None = None
    auth_token: str | None = None
    enabled: bool | None = None
    timeout_seconds: int | None = Field(None, ge=1, le=300)


class UpstreamResponse(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    url: str
    description: str
    auth_type: str
    auth_header_name: str | None
    enabled: bool
    timeout_seconds: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────

@router.post("", response_model=UpstreamResponse, status_code=status.HTTP_201_CREATED)
async def create_upstream(
    body: UpstreamCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UpstreamServer:
    """Register a new upstream MCP server. Admin only."""
    # Validate SSRF
    try:
        validate_upstream_url(body.url)
    except GatewaySSRFError as err:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"SSRF validation failed: {err}") from err

    # Check unique slug
    existing = await db.execute(select(UpstreamServer).where(UpstreamServer.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Upstream with slug '{body.slug}' already exists.")

    auth_enc = encrypt_credential(body.auth_token) if body.auth_token else None

    upstream = UpstreamServer(
        slug=body.slug,
        name=body.name,
        url=body.url,
        description=body.description,
        auth_type=body.auth_type.value,
        auth_header_name=body.auth_header_name,
        auth_value_enc=auth_enc,
        enabled=body.enabled,
        timeout_seconds=body.timeout_seconds,
        created_by=admin.id,
    )
    db.add(upstream)
    await db.commit()
    await db.refresh(upstream)
    return upstream


@router.get("", response_model=list[UpstreamResponse])
async def list_upstreams(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[UpstreamServer]:
    """List all registered upstream servers. Admin only."""
    res = await db.execute(select(UpstreamServer).order_by(UpstreamServer.created_at.asc()))
    return list(res.scalars().all())


@router.get("/{upstream_id}", response_model=UpstreamResponse)
async def get_upstream(
    upstream_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UpstreamServer:
    upstream = await db.get(UpstreamServer, upstream_id)
    if not upstream:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upstream not found.")
    return upstream


@router.patch("/{upstream_id}", response_model=UpstreamResponse)
async def update_upstream(
    upstream_id: uuid.UUID,
    body: UpstreamUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UpstreamServer:
    upstream = await db.get(UpstreamServer, upstream_id)
    if not upstream:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upstream not found.")

    if body.url is not None:
        try:
            validate_upstream_url(body.url)
        except GatewaySSRFError as err:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"SSRF validation failed: {err}") from err
        upstream.url = body.url

    if body.name is not None:
        upstream.name = body.name
    if body.description is not None:
        upstream.description = body.description
    if body.auth_type is not None:
        upstream.auth_type = body.auth_type.value
    if body.auth_header_name is not None:
        upstream.auth_header_name = body.auth_header_name
    if body.auth_token is not None:
        upstream.auth_value_enc = encrypt_credential(body.auth_token) if body.auth_token else None
    if body.enabled is not None:
        upstream.enabled = body.enabled
    if body.timeout_seconds is not None:
        upstream.timeout_seconds = body.timeout_seconds

    await db.commit()
    await db.refresh(upstream)
    return upstream


@router.delete("/{upstream_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_upstream(
    upstream_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    upstream = await db.get(UpstreamServer, upstream_id)
    if not upstream:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upstream not found.")
    await db.delete(upstream)
    await db.commit()


@router.get("/{upstream_id}/health")
async def check_upstream_health(
    upstream_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Perform a live health probe against the upstream MCP server."""
    upstream = await db.get(UpstreamServer, upstream_id)
    if not upstream:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upstream not found.")

    client = aggregator.get_client(upstream)
    t0 = time.perf_counter()
    try:
        tools = await client.list_tools()
        latency_ms = int((time.perf_counter() - t0) * 1000)
        return {
            "status": "healthy",
            "latency_ms": latency_ms,
            "tool_count": len(tools),
            "tools": [t.get("name") for t in tools],
        }
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        return {
            "status": "unhealthy",
            "latency_ms": latency_ms,
            "error": str(exc),
        }
