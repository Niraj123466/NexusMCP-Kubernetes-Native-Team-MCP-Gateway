"""MCP Aggregator — coordinates connection pooling, tool discovery, routing, and audit logging."""
from __future__ import annotations

import json
import time
from typing import Any
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from gateway.auth.api_keys import hash_args
from gateway.config import settings
from gateway.db.models import (
    AuditLog,
    AuditOutcome,
    ToolPermission,
    UpstreamAuthType,
    UpstreamServer,
    User,
    UserRole,
)
from gateway.mcp.crypto import decrypt_credential
from gateway.mcp.namespacing import namespace_tool, parse_namespaced_tool

log = structlog.get_logger(__name__)


def _parse_mcp_response(resp_text: str) -> dict[str, Any]:
    """Parse MCP HTTP response which may be pure JSON or an SSE stream (event: message\\ndata: {...})."""
    resp_text = resp_text.strip()
    if resp_text.startswith("event:") or "data:" in resp_text:
        for line in resp_text.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                payload_str = line[len("data:"):].strip()
                return json.loads(payload_str)
    return json.loads(resp_text)


class UpstreamClient:
    """Maintains connection state and session for a single upstream MCP Streamable HTTP server."""

    def __init__(
        self,
        url: str,
        auth_type: str = UpstreamAuthType.none,
        auth_header_name: str | None = None,
        auth_token: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self.url = url
        self.auth_type = auth_type
        self.auth_header_name = auth_header_name
        self.auth_token = auth_token
        self.timeout = timeout
        self.session_id: str | None = None
        self._request_id = 0

    def _next_id(self) -> int:
        self._request_id += 1
        return self._request_id

    def _auth_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
            "User-Agent": "NexusMCP-Gateway/0.1.0",
        }
        if self.session_id:
            headers["mcp-session-id"] = self.session_id

        if self.auth_type == UpstreamAuthType.bearer and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        elif self.auth_type == UpstreamAuthType.header and self.auth_header_name and self.auth_token:
            headers[self.auth_header_name] = self.auth_token

        return headers

    async def initialize(self, client: httpx.AsyncClient) -> None:
        """Perform MCP initialize handshake and extract mcp-session-id."""
        init_payload = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "NexusMCP-Gateway", "version": "0.1.0"},
            },
        }
        headers = self._auth_headers()
        headers.pop("mcp-session-id", None)

        resp = await client.post(self.url, json=init_payload, headers=headers)
        resp.raise_for_status()

        # Session ID may be in response headers or result
        new_session = resp.headers.get("mcp-session-id")
        if new_session:
            self.session_id = new_session
        else:
            data = _parse_mcp_response(resp.text)
            self.session_id = data.get("result", {}).get("sessionId")

    async def list_tools(self) -> list[dict[str, Any]]:
        """List all tools exposed by this upstream server."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            if not self.session_id:
                await self.initialize(client)

            list_payload = {
                "jsonrpc": "2.0",
                "id": self._next_id(),
                "method": "tools/list",
                "params": {},
            }
            resp = await client.post(self.url, json=list_payload, headers=self._auth_headers())

            # If session expired, retry once
            if resp.status_code == 400 and "session" in resp.text.lower():
                await self.initialize(client)
                resp = await client.post(self.url, json=list_payload, headers=self._auth_headers())

            resp.raise_for_status()
            data = _parse_mcp_response(resp.text)
            tools: list[dict[str, Any]] = data.get("result", {}).get("tools", [])
            return tools

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool call against the upstream server."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            if not self.session_id:
                await self.initialize(client)

            call_payload = {
                "jsonrpc": "2.0",
                "id": self._next_id(),
                "method": "tools/call",
                "params": {"name": name, "arguments": arguments},
            }
            resp = await client.post(self.url, json=call_payload, headers=self._auth_headers())

            if resp.status_code == 400 and "session" in resp.text.lower():
                await self.initialize(client)
                resp = await client.post(self.url, json=call_payload, headers=self._auth_headers())

            resp.raise_for_status()
            data = _parse_mcp_response(resp.text)
            result: dict[str, Any] = data.get("result", {})
            return result


class MCPAggregator:
    """Manages multi-upstream aggregation, permission gating, routing, and audit logging."""

    def __init__(self) -> None:
        self._clients: dict[str, UpstreamClient] = {}

    def get_client(self, upstream: UpstreamServer) -> UpstreamClient:
        token = decrypt_credential(upstream.auth_value_enc) if upstream.auth_value_enc else None
        client_key = f"{upstream.id}_{upstream.updated_at}"
        if client_key not in self._clients:
            self._clients[client_key] = UpstreamClient(
                url=upstream.url,
                auth_type=upstream.auth_type,
                auth_header_name=upstream.auth_header_name,
                auth_token=token,
                timeout=float(upstream.timeout_seconds),
            )
        return self._clients[client_key]

    async def list_all_tools(self, db: AsyncSession, user: User) -> list[dict[str, Any]]:
        """
        Query all enabled upstreams and return aggregated, namespaced tools.
        Filters out any tools explicitly denied by ToolPermission for the caller.
        """
        upstreams_res = await db.execute(
            select(UpstreamServer).where(UpstreamServer.enabled.is_(True))
        )
        upstreams = list(upstreams_res.scalars().all())

        # Load permissions for caller
        perms_res = await db.execute(
            select(ToolPermission).where(ToolPermission.user_id == user.id)
        )
        denied_perms = {
            (p.upstream_id, p.tool_name) for p in perms_res.scalars().all() if not p.allowed
        }

        aggregated_tools: list[dict[str, Any]] = []

        for upstream in upstreams:
            client = self.get_client(upstream)
            try:
                raw_tools = await client.list_tools()
            except Exception as exc:
                log.warning("upstream_list_tools_failed", slug=upstream.slug, error=str(exc))
                continue

            for t in raw_tools:
                orig_name = t.get("name", "")
                if (upstream.id, orig_name) in denied_perms:
                    continue  # Explicitly denied

                namespaced_name = namespace_tool(upstream.slug, orig_name)
                tool_copy = dict(t)
                tool_copy["name"] = namespaced_name
                tool_copy["original_name"] = orig_name
                tool_copy["upstream"] = {
                    "id": str(upstream.id),
                    "slug": upstream.slug,
                    "name": upstream.name,
                }
                aggregated_tools.append(tool_copy)

        return aggregated_tools

    async def execute_tool(
        self,
        db: AsyncSession,
        user: User,
        namespaced_tool: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Execute a namespaced tool, write audit logs, and return the result.
        """
        start_time = time.perf_counter()
        slug, orig_tool = parse_namespaced_tool(namespaced_tool)
        args_hash = hash_args(arguments, settings.gateway_secret_key)

        upstream_res = await db.execute(
            select(UpstreamServer).where(UpstreamServer.slug == slug)
        )
        upstream = upstream_res.scalar_one_or_none()

        if not upstream or not upstream.enabled:
            # Audit log denial
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            audit = AuditLog(
                user_id=user.id,
                upstream_id=upstream.id if upstream else None,
                tool_name=namespaced_tool,
                args_hash=args_hash,
                duration_ms=duration_ms,
                outcome=AuditOutcome.denied.value,
                error_message=f"Upstream server '{slug}' is unknown or disabled.",
            )
            db.add(audit)
            await db.commit()
            raise ValueError(f"Upstream server '{slug}' is not available.")

        # Check permissions
        perm_res = await db.execute(
            select(ToolPermission).where(
                ToolPermission.user_id == user.id,
                ToolPermission.upstream_id == upstream.id,
                ToolPermission.tool_name == orig_tool,
            )
        )
        perm = perm_res.scalar_one_or_none()
        if perm is not None and not perm.allowed:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            audit = AuditLog(
                user_id=user.id,
                upstream_id=upstream.id,
                tool_name=namespaced_tool,
                args_hash=args_hash,
                duration_ms=duration_ms,
                outcome=AuditOutcome.denied.value,
                error_message="User does not have permission to execute this tool.",
            )
            db.add(audit)
            await db.commit()
            raise PermissionError(f"Permission denied for tool '{namespaced_tool}'.")

        client = self.get_client(upstream)
        try:
            result = await client.call_tool(orig_tool, arguments)
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            is_error = result.get("isError", False)
            audit = AuditLog(
                user_id=user.id,
                upstream_id=upstream.id,
                tool_name=namespaced_tool,
                args_hash=args_hash,
                duration_ms=duration_ms,
                outcome=AuditOutcome.error.value if is_error else AuditOutcome.success.value,
                error_message=str(result.get("content")) if is_error else None,
            )
            db.add(audit)
            await db.commit()
            return result
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            outcome = AuditOutcome.timeout.value if "timeout" in str(exc).lower() else AuditOutcome.error.value
            audit = AuditLog(
                user_id=user.id,
                upstream_id=upstream.id,
                tool_name=namespaced_tool,
                args_hash=args_hash,
                duration_ms=duration_ms,
                outcome=outcome,
                error_message=str(exc),
            )
            db.add(audit)
            await db.commit()
            log.error("execute_tool_failed", tool=namespaced_tool, error=str(exc))
            raise RuntimeError(f"Tool execution failed: {exc}") from exc


aggregator = MCPAggregator()
