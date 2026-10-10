"""Fetch MCP tool implementations."""
from __future__ import annotations

from typing import Any
import httpx
import structlog

from fetch_mcp.config import settings
from fetch_mcp.ssrf_guard import SSRFValidationError, validate_url

log = structlog.get_logger(__name__)


async def fetch_url(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Safely fetch the contents of a remote web page or API over HTTP/HTTPS.

    Protected against Server-Side Request Forgery (SSRF) — requests to internal,
    loopback, and cloud metadata addresses are strictly blocked.

    Args:
        url: The full HTTP or HTTPS URL to fetch.
        method: HTTP method (GET or HEAD, default 'GET').
        headers: Optional custom HTTP headers to include in the request.

    Returns:
        Dictionary containing status_code, content, headers, content_type, and final URL.
    """
    method_upper = method.upper()
    if method_upper not in ("GET", "HEAD"):
        raise ValueError(f"Method '{method}' is not allowed. Only GET and HEAD are permitted.")

    # 1. SSRF Validation
    try:
        validated_url = validate_url(url)
    except SSRFValidationError as err:
        log.warning("ssrf_blocked", url=url, reason=str(err))
        raise RuntimeError(f"SSRF guard blocked request: {err}") from err

    # 2. Execute HTTP Request
    req_headers = {"User-Agent": "NexusMCP-Fetch/0.1.0"}
    if headers:
        # Prevent overriding critical transport headers
        safe_headers = {k: v for k, v in headers.items() if k.lower() not in ("host", "connection")}
        req_headers.update(safe_headers)

    try:
        async with httpx.AsyncClient(
            timeout=settings.timeout_seconds,
            follow_redirects=False,  # Disallow automatic redirect to prevent redirect-based SSRF bypass
        ) as client:
            resp = await client.request(
                method=method_upper,
                url=validated_url,
                headers=req_headers,
            )

            # Check if redirect
            if resp.is_redirect:
                redirect_target = resp.headers.get("location")
                if redirect_target:
                    # Validate redirect target
                    try:
                        validate_url(redirect_target)
                    except SSRFValidationError as r_err:
                        raise RuntimeError(f"SSRF blocked redirect target: {r_err}") from r_err

            content = resp.text
            if len(content) > settings.max_content_length:
                content = content[:settings.max_content_length] + "\n...[truncated]"

            return {
                "url": str(resp.url),
                "status_code": resp.status_code,
                "content_type": resp.headers.get("content-type", ""),
                "content": content,
                "headers": dict(resp.headers),
            }
    except Exception as exc:
        log.error("fetch_error", url=url, error=str(exc))
        raise RuntimeError(f"Failed to fetch '{url}': {exc}") from exc
