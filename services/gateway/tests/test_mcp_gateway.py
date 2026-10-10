"""Unit and integration tests for MCP Gateway (Crypto, Namespacing, SSRF guard, Upstreams, Proxy)."""
import uuid
from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from gateway.auth.api_keys import generate_api_key
from gateway.db.models import ApiKey, AuditLog, Base, UpstreamServer, User, UserRole
from gateway.db.session import get_db
from gateway.main import app
from gateway.mcp.crypto import decrypt_credential, encrypt_credential
from gateway.mcp.namespacing import namespace_tool, parse_namespaced_tool
from gateway.mcp.ssrf_guard import GatewaySSRFError, validate_upstream_url


def test_crypto_roundtrip():
    secret = "my-super-secret-upstream-token-12345"
    encrypted = encrypt_credential(secret)
    assert encrypted != secret
    decrypted = decrypt_credential(encrypted)
    assert decrypted == secret


def test_namespacing():
    slug = "woocommerce"
    tool = "list_products"
    namespaced = namespace_tool(slug, tool)
    assert namespaced == "woocommerce__list_products"

    parsed_slug, parsed_tool = parse_namespaced_tool(namespaced)
    assert parsed_slug == slug
    assert parsed_tool == tool


def test_gateway_ssrf_validation():
    # Known internal cluster host should be allowed
    assert validate_upstream_url("http://woocommerce-mcp-svc:8001/mcp")

    # Localhost forbidden
    with pytest.raises(GatewaySSRFError):
        validate_upstream_url("http://localhost:8000/mcp")

    # Private IP forbidden
    with pytest.raises(GatewaySSRFError):
        validate_upstream_url("http://192.168.1.50:8000/mcp")

    # Metadata IP forbidden
    with pytest.raises(GatewaySSRFError):
        validate_upstream_url("http://169.254.169.254/mcp")


@pytest.fixture
async def gateway_test_env():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Seed Admin
        admin_key, admin_hash, admin_prefix = generate_api_key()
        admin = User(username="admin", email="admin@nexusmcp.local", role=UserRole.admin)
        session.add(admin)
        await session.flush()
        session.add(ApiKey(user_id=admin.id, name="Admin Key", prefix=admin_prefix, key_hash=admin_hash))

        # Seed Member
        member_key, member_hash, member_prefix = generate_api_key()
        member = User(username="member", email="member@nexusmcp.local", role=UserRole.member)
        session.add(member)
        await session.flush()
        session.add(ApiKey(user_id=member.id, name="Member Key", prefix=member_prefix, key_hash=member_hash))

        await session.commit()

        async def override_get_db():
            yield session

        app.dependency_overrides[get_db] = override_get_db

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, admin_key, member_key, session

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_upstream_crud(gateway_test_env):
    client, admin_key, member_key, session = gateway_test_env

    # 1. Non-admin forbidden from creating upstreams
    res = await client.post(
        "/api/upstreams",
        headers={"X-API-Key": member_key},
        json={"slug": "time", "name": "Time", "url": "http://time-mcp-svc:8002/mcp"},
    )
    assert res.status_code == 403

    # 2. Admin creates upstream
    res = await client.post(
        "/api/upstreams",
        headers={"X-API-Key": admin_key},
        json={
            "slug": "time",
            "name": "Time Service",
            "url": "http://time-mcp-svc:8002/mcp",
            "description": "Time tools",
            "auth_type": "bearer",
            "auth_token": "secret_token_val",
        },
    )
    assert res.status_code == 201
    upstream_data = res.json()
    assert upstream_data["slug"] == "time"
    assert "auth_token" not in upstream_data  # plain token not exposed

    upstream_id = upstream_data["id"]

    # 3. List upstreams
    res = await client.get("/api/upstreams", headers={"X-API-Key": admin_key})
    assert res.status_code == 200
    assert len(res.json()) == 1

    # 4. Update upstream
    res = await client.patch(
        f"/api/upstreams/{upstream_id}",
        headers={"X-API-Key": admin_key},
        json={"name": "Updated Time Service", "enabled": False},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Time Service"
    assert res.json()["enabled"] is False


@pytest.mark.asyncio
async def test_mcp_proxy_protocol_and_audit(gateway_test_env):
    client, admin_key, member_key, session = gateway_test_env

    # Register an enabled upstream
    res = await client.post(
        "/api/upstreams",
        headers={"X-API-Key": admin_key},
        json={
            "slug": "time",
            "name": "Time Service",
            "url": "http://time-mcp-svc:8002/mcp",
            "enabled": True,
        },
    )
    assert res.status_code == 201

    # 1. Test /mcp initialize
    init_req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test-client", "version": "1.0"},
        },
    }
    res = await client.post("/mcp", headers={"X-API-Key": member_key}, json=init_req)
    assert res.status_code == 200
    data = res.json()
    assert data["result"]["serverInfo"]["name"] == "NexusMCP-Unified-Gateway"
    session_id = res.headers.get("mcp-session-id")
    assert session_id is not None

    # 2. Test /mcp tools/list (mock upstream tools)
    mock_tools = [
        {
            "name": "get_current_time",
            "description": "Get current time",
            "inputSchema": {"type": "object", "properties": {"timezone": {"type": "string"}}},
        }
    ]

    with patch("gateway.mcp.aggregator.UpstreamClient.list_tools", new=AsyncMock(return_value=mock_tools)):
        list_req = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
        res = await client.post("/mcp", headers={"mcp-session-id": session_id}, json=list_req)
        assert res.status_code == 200
        tools = res.json()["result"]["tools"]
        assert len(tools) == 1
        assert tools[0]["name"] == "time__get_current_time"

    # 3. Test /mcp tools/call & Audit Log creation
    mock_call_result = {
        "content": [{"type": "text", "text": '{"time": "12:00:00"}'}],
        "isError": False,
    }

    with patch("gateway.mcp.aggregator.UpstreamClient.call_tool", new=AsyncMock(return_value=mock_call_result)):
        call_req = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "time__get_current_time", "arguments": {"timezone": "UTC"}},
        }
        res = await client.post("/mcp", headers={"mcp-session-id": session_id}, json=call_req)
        assert res.status_code == 200
        assert res.json()["result"]["isError"] is False

    # 4. Verify Audit Log was recorded
    res = await client.get("/api/audit", headers={"X-API-Key": admin_key})
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) == 1
    assert logs[0]["tool_name"] == "time__get_current_time"
    assert logs[0]["outcome"] == "success"
    assert logs[0]["args_hash"] is not None
