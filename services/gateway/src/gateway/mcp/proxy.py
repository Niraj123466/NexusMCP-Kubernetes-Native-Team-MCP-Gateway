"""MCP Proxy router — exposes unified Streamable HTTP /mcp endpoint for external MCP clients."""
from __future__ import annotations

import json
import uuid
from typing import Any
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from gateway.auth.api_keys import verify_api_key
from gateway.db.models import ApiKey, User
from gateway.db.session import AsyncSessionLocal, get_db
from gateway.mcp.aggregator import aggregator

log = structlog.get_logger(__name__)
router = APIRouter(tags=["mcp-proxy"])

# In-memory sessions for MCP streamable HTTP connections
_active_sessions: dict[str, uuid.UUID] = {}  # session_id -> user_id


async def _resolve_mcp_user(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    api_key_query: str | None = Query(None, alias="api_key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate MCP client from either X-API-Key header or ?api_key query parameter."""
    raw_key = x_api_key or api_key_query
    if not raw_key or len(raw_key) < 8:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    prefix = raw_key[:8]
    res = await db.execute(
        select(ApiKey)
        .options(selectinload(ApiKey.user))
        .where(ApiKey.prefix == prefix, ApiKey.revoked_at.is_(None))
        .join(ApiKey.user)
        .where(User.is_active.is_(True))
    )
    candidates = list(res.scalars().all())

    matched_key: ApiKey | None = None
    for cand in candidates:
        if verify_api_key(raw_key, cand.key_hash):
            matched_key = cand
            break

    if not matched_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key.",
        )

    return matched_key.user


@router.get("/mcp")
async def mcp_sse_get(
    request: Request,
    user: User = Depends(_resolve_mcp_user),
) -> Response:
    """SSE endpoint for Streamable HTTP transport clients."""
    accept = request.headers.get("accept", "")
    session_id = str(uuid.uuid4().hex)
    _active_sessions[session_id] = user.id

    async def event_generator():
        # Emit initial endpoint information event
        endpoint_info = {"sessionId": session_id}
        yield f"event: endpoint\ndata: {json.dumps(endpoint_info)}\n\n"

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "mcp-session-id": session_id,
    }
    return StreamingResponse(event_generator(), headers=headers)


@router.post("/mcp")
async def mcp_post(
    request: Request,
    mcp_session_id: str | None = Header(None, alias="mcp-session-id"),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    api_key_query: str | None = Query(None, alias="api_key"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """JSON-RPC handler for MCP Streamable HTTP."""
    # 1. Resolve user
    user: User | None = None
    if mcp_session_id and mcp_session_id in _active_sessions:
        user_id = _active_sessions[mcp_session_id]
        user = await db.get(User, user_id)

    if not user:
        user = await _resolve_mcp_user(x_api_key=x_api_key, api_key_query=api_key_query, db=db)

    # 2. Parse JSON-RPC request
    try:
        body = await request.json()
    except Exception:
        return Response(
            content=json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}),
            status_code=400,
            media_type="application/json",
        )

    method = body.get("method")
    req_id = body.get("id")
    params = body.get("params", {})

    session_id = mcp_session_id or str(uuid.uuid4().hex)
    _active_sessions[session_id] = user.id

    # 3. Handle MCP methods
    if method == "initialize":
        result = {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {"listChanged": True},
            },
            "serverInfo": {
                "name": "NexusMCP-Unified-Gateway",
                "version": "0.1.0",
            },
        }
        res_data = {"jsonrpc": "2.0", "id": req_id, "result": result}

    elif method == "notifications/initialized":
        # Notification acknowledgment
        return Response(status_code=200, headers={"mcp-session-id": session_id})

    elif method == "tools/list":
        tools = await aggregator.list_all_tools(db, user)
        # Format tools according to MCP specification
        mcp_tools = [
            {
                "name": t["name"],
                "description": t.get("description", ""),
                "inputSchema": t.get("inputSchema", {"type": "object"}),
            }
            for t in tools
        ]
        res_data = {"jsonrpc": "2.0", "id": req_id, "result": {"tools": mcp_tools}}

    elif method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        try:
            call_res = await aggregator.execute_tool(db, user, tool_name, arguments)
            res_data = {"jsonrpc": "2.0", "id": req_id, "result": call_res}
        except Exception as exc:
            res_data = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": str(exc)}],
                    "isError": True,
                },
            }

    else:
        res_data = {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Method '{method}' not found"},
        }

    # Format response: if client accepts text/event-stream, return SSE format
    accept = request.headers.get("accept", "")
    if "text/event-stream" in accept:
        sse_text = f"event: message\ndata: {json.dumps(res_data)}\n\n"
        return Response(
            content=sse_text,
            status_code=200,
            media_type="text/event-stream",
            headers={"mcp-session-id": session_id},
        )

    return Response(
        content=json.dumps(res_data),
        status_code=200,
        media_type="application/json",
        headers={"mcp-session-id": session_id},
    )
