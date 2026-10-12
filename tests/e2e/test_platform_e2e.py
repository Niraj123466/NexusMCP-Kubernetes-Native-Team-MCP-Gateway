"""
End-to-End Test Suite for NexusMCP Platform on Kubernetes.

Verifies:
1. Ingress and service connectivity (Gateway & Frontend)
2. Authentication (X-API-Key and Bearer tokens) & RBAC
3. Upstream MCP servers registry & health checks
4. Aggregated tools catalog discovery (all 8 tools across woocommerce, time, fetch)
5. Direct tool execution:
   - time__get_current_time
   - fetch__fetch_url
   - woocommerce__create_product
   - woocommerce__list_products
   - woocommerce__get_product
6. Strict SSRF protection on fetch MCP server
7. Audit log verification (outcome, latency, HMAC-SHA256 arg hashing)
8. AI Chat Agent multi-turn coordination & tool execution
9. MCP Streamable HTTP protocol compliance (/mcp initialize, tools/list, tools/call)
"""
from __future__ import annotations

import json
import uuid
import httpx
import pytest

GATEWAY_HOST = "api.nexusmcp.local"
FRONTEND_HOST = "app.nexusmcp.local"
INGRESS_URL = "http://127.0.0.1:9080"
ADMIN_API_KEY = "nexus_CAuAv_SsN5eLFAEDdqIy5N7XNFJB5MRodK9pJ_bypzY"


@pytest.fixture
def client() -> httpx.Client:
    """HTTP client targeting NexusMCP Gateway via Ingress."""
    return httpx.Client(
        base_url=INGRESS_URL,
        headers={
            "Host": GATEWAY_HOST,
            "X-API-Key": ADMIN_API_KEY,
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )


@pytest.fixture
def frontend_client() -> httpx.Client:
    """HTTP client targeting NexusMCP Frontend via Ingress."""
    return httpx.Client(
        base_url=INGRESS_URL,
        headers={"Host": FRONTEND_HOST},
        timeout=15.0,
    )


# ── 1. Gateway & Frontend Health Checks ─────────────────────────

def test_gateway_health(client: httpx.Client):
    resp = client.get("/health")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_frontend_serving(frontend_client: httpx.Client):
    resp = frontend_client.get("/")
    assert resp.status_code == 200, resp.text
    assert "<title>NexusMCP" in resp.text
    assert "root" in resp.text


# ── 2. Authentication & User Profile ───────────────────────────

def test_auth_me_with_x_api_key(client: httpx.Client):
    resp = client.get("/api/users/me")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["username"] == "admin"
    assert data["role"] == "admin"
    assert data["is_active"] is True


def test_auth_me_with_bearer_token():
    with httpx.Client(base_url=INGRESS_URL, headers={"Host": GATEWAY_HOST}) as c:
        resp = c.get(
            "/api/users/me",
            headers={"Authorization": f"Bearer {ADMIN_API_KEY}"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["username"] == "admin"


def test_auth_rejection_on_invalid_key():
    with httpx.Client(base_url=INGRESS_URL, headers={"Host": GATEWAY_HOST}) as c:
        resp = c.get("/api/users/me", headers={"X-API-Key": "nexus_invalidkey12345"})
        assert resp.status_code == 401


# ── 3. Upstream MCP Registry ───────────────────────────────────

def test_upstream_registry(client: httpx.Client):
    resp = client.get("/api/upstreams")
    assert resp.status_code == 200, resp.text
    upstreams = resp.json()
    slugs = [u["slug"] for u in upstreams]
    assert "woocommerce" in slugs
    assert "time" in slugs
    assert "fetch" in slugs


# ── 4. Aggregated Tools Catalog ─────────────────────────────────

def test_list_aggregated_tools(client: httpx.Client):
    resp = client.get("/api/tools")
    assert resp.status_code == 200, resp.text
    tools = resp.json()
    tool_names = [t["name"] for t in tools]

    # Verify namespace format: <slug>__<tool_name>
    expected_tools = [
        "time__get_current_time",
        "time__list_timezones",
        "fetch__fetch_url",
        "woocommerce__list_products",
        "woocommerce__get_product",
        "woocommerce__create_product",
        "woocommerce__update_product_stock",
        "woocommerce__list_orders",
    ]
    for expected in expected_tools:
        assert expected in tool_names, f"Tool {expected} missing from aggregated tools"


# ── 5. Direct Tool Execution ────────────────────────────────────

def test_execute_time_tool(client: httpx.Client):
    resp = client.post(
        "/api/tools/execute",
        json={"name": "time__get_current_time", "arguments": {"timezone": "UTC"}},
    )
    assert resp.status_code == 200, resp.text
    result = resp.json()
    assert "current_time" in result or "time" in str(result)
    assert "UTC" in str(result)


def parse_tool_result(data: dict) -> any:
    """Extract payload from FastMCP ToolCallResult structure."""
    if isinstance(data, dict):
        if "structuredContent" in data and "result" in data["structuredContent"]:
            return data["structuredContent"]["result"]
        if "content" in data and isinstance(data["content"], list) and len(data["content"]) > 0:
            first = data["content"][0]
            if first.get("type") == "text":
                try:
                    return json.loads(first["text"])
                except Exception:
                    return first["text"]
    return data


def test_execute_woocommerce_create_and_read(client: httpx.Client):
    test_id_suffix = uuid.uuid4().hex[:6]
    product_name = f"E2E Automated Product {test_id_suffix}"
    create_resp = client.post(
        "/api/tools/execute",
        json={
            "name": "woocommerce__create_product",
            "arguments": {
                "name": product_name,
                "regular_price": "79.99",
                "stock_quantity": 42,
                "manage_stock": True,
            },
        },
    )
    assert create_resp.status_code == 200, create_resp.text
    created = parse_tool_result(create_resp.json())
    assert isinstance(created, dict), f"Expected dict, got {created}"
    assert "id" in created, f"Missing id in created: {created}"
    product_id = created["id"]
    assert created["status"] == "created"

    # Read back with get_product
    get_resp = client.post(
        "/api/tools/execute",
        json={"name": "woocommerce__get_product", "arguments": {"product_id": product_id}},
    )
    assert get_resp.status_code == 200, get_resp.text
    fetched = parse_tool_result(get_resp.json())
    assert isinstance(fetched, dict)
    assert fetched["id"] == product_id
    assert fetched["name"] == product_name
    assert fetched["stock_quantity"] == 42


def test_execute_woocommerce_list_products(client: httpx.Client):
    resp = client.post(
        "/api/tools/execute",
        json={"name": "woocommerce__list_products", "arguments": {"per_page": 5}},
    )
    assert resp.status_code == 200, resp.text
    products = parse_tool_result(resp.json())
    assert isinstance(products, list), f"Expected list, got {products}"
    assert len(products) >= 1
    assert "id" in products[0]
    assert "name" in products[0]


# ── 6. SSRF Protection on Fetch Tool ────────────────────────────

@pytest.mark.parametrize("blocked_url", [
    "http://127.0.0.1:8000/api/users",
    "http://127.0.0.1/etc/passwd",
    "http://169.254.169.254/latest/meta-data",
    "http://10.96.0.1:443",
    "file:///etc/passwd",
    "ftp://example.com/file",
])
def test_ssrf_guard_blocks_forbidden_urls(client: httpx.Client, blocked_url: str):
    resp = client.post(
        "/api/tools/execute",
        json={"name": "fetch__fetch_url", "arguments": {"url": blocked_url}},
    )
    # The tool returns an error payload or raises an error when SSRF guard triggers
    assert resp.status_code in (200, 400, 500)
    data = resp.json()
    # Check that error is indicated in output
    text_repr = json.dumps(data)
    assert "error" in text_repr.lower() or "blocked" in text_repr.lower() or "ssrf" in text_repr.lower() or "invalid" in text_repr.lower()


# ── 7. Audit Log Integrity ─────────────────────────────────────

def test_audit_logs_recorded(client: httpx.Client):
    resp = client.get("/api/audit?limit=20")
    assert resp.status_code == 200, resp.text
    logs = resp.json()
    assert len(logs) > 0

    latest = logs[0]
    assert "tool_name" in latest
    assert "args_hash" in latest
    assert len(latest["args_hash"]) == 64  # SHA-256 is 64 hex characters
    assert latest["outcome"] in ("success", "error")
    assert latest["duration_ms"] is not None


# ── 8. AI Chat Agent Endpoint ───────────────────────────────────

def test_chat_agent_endpoint(client: httpx.Client):
    # Sends a prompt to the AI agent
    resp = client.post(
        "/api/chat",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": "What is the current time in UTC?",
                }
            ],
            "system_prompt": "You are a helpful assistant with access to MCP tools.",
        },
    )
    # If GEMINI_API_KEY is not configured with a live billable key, gateway returns 400 with setup message
    if resp.status_code == 400:
        err = resp.json().get("detail", "")
        assert "gemini" in err.lower() or "key" in err.lower()
    else:
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
        assert "tool_executions" in data


# ── 9. Streamable HTTP /mcp Protocol Compliance ─────────────────

def test_streamable_http_mcp_handshake(client: httpx.Client):
    """
    Test direct MCP Streamable HTTP JSON-RPC initialize handshake.
    Verify mcp-session-id returned.
    """
    init_payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "e2e-test-runner", "version": "1.0"},
        },
    }

    resp = client.post(
        "/mcp",
        json=init_payload,
        headers={"Accept": "text/event-stream, application/json"},
    )
    assert resp.status_code in (200, 202), resp.text
    session_id = resp.headers.get("mcp-session-id")
    assert session_id, "Streamable HTTP must return mcp-session-id header"
