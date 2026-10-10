"""Aggregated tools discovery and direct execution router."""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.auth.deps import get_current_user
from gateway.db.models import User
from gateway.db.session import get_db
from gateway.mcp.aggregator import aggregator

router = APIRouter(prefix="/api/tools", tags=["tools"])


class ToolExecuteRequest(BaseModel):
    name: str = Field(..., description="Namespaced tool name: <upstream_slug>__<tool_name>")
    arguments: dict[str, Any] = Field(default_factory=dict)


@router.get("")
async def list_tools(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List all aggregated tools from enabled upstreams accessible to the current user."""
    return await aggregator.list_all_tools(db, user)


@router.post("/execute")
async def execute_tool(
    body: ToolExecuteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Execute a namespaced tool as the authenticated user."""
    return await aggregator.execute_tool(db, user, body.name, body.arguments)
