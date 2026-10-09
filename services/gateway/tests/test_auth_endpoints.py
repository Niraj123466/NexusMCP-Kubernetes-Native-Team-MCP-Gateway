"""Integration tests for Auth dependency, Users router, and Keys router using httpx AsyncClient."""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from gateway.auth.api_keys import _hash_key, generate_api_key
from gateway.db.models import ApiKey, Base, User, UserRole
from gateway.db.session import get_db
from gateway.main import app


@pytest.fixture
async def test_db_session():
    # In-memory async SQLite engine
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def client_and_admin(test_db_session: AsyncSession):
    # Seed admin user and key
    admin_raw_key, admin_hash, admin_prefix = generate_api_key()
    admin = User(
        username="admin",
        email="admin@nexusmcp.local",
        role=UserRole.admin,
    )
    test_db_session.add(admin)
    await test_db_session.flush()

    admin_key = ApiKey(
        user_id=admin.id,
        name="Admin Key",
        prefix=admin_prefix,
        key_hash=admin_hash,
    )
    test_db_session.add(admin_key)
    await test_db_session.commit()

    # Override get_db dependency
    async def override_get_db():
        yield test_db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client, admin_raw_key, admin

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_auth_rejection(client_and_admin):
    client, _, _ = client_and_admin

    # No key provided
    resp = await client.get("/api/users")
    assert resp.status_code == 403 or resp.status_code == 401  # Header missing

    # Invalid key provided
    resp = await client.get("/api/users", headers={"X-API-Key": "nexus_invalidkey12345"})
    assert resp.status_code == 401
    assert "Invalid or revoked" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_user_lifecycle_and_permissions(client_and_admin):
    client, admin_key, admin = client_and_admin

    # Admin lists users
    resp = await client.get("/api/users", headers={"X-API-Key": admin_key})
    assert resp.status_code == 200
    users = resp.json()
    assert len(users) == 1
    assert users[0]["username"] == "admin"

    # Admin creates member user
    resp = await client.post(
        "/api/users",
        headers={"X-API-Key": admin_key},
        json={
            "username": "alice",
            "email": "alice@example.com",
            "role": "member",
        },
    )
    assert resp.status_code == 201
    alice_data = resp.json()
    assert alice_data["username"] == "alice"
    assert alice_data["role"] == "member"
    alice_id = alice_data["id"]

    # Issue API key for Alice (as Admin)
    resp = await client.post(
        "/api/keys",
        headers={"X-API-Key": admin_key},
        json={"name": "Alice Key", "user_id": alice_id},
    )
    assert resp.status_code == 201
    key_data = resp.json()
    alice_key = key_data["key"]
    assert alice_key.startswith("nexus_")
    assert "key_hash" not in key_data

    # Alice accesses /api/users (Forbidden for member)
    resp = await client.get("/api/users", headers={"X-API-Key": alice_key})
    assert resp.status_code == 403

    # Alice accesses /api/keys (Sees only her own key)
    resp = await client.get("/api/keys", headers={"X-API-Key": alice_key})
    assert resp.status_code == 200
    alice_keys = resp.json()
    assert len(alice_keys) == 1
    assert alice_keys[0]["user_id"] == alice_id
    assert alice_keys[0]["prefix"] == key_data["prefix"]

    # Alice revokes her own key
    key_id = key_data["id"]
    resp = await client.delete(f"/api/keys/{key_id}", headers={"X-API-Key": alice_key})
    assert resp.status_code == 204

    # Alice's key is now revoked — subsequent call fails with 401
    resp = await client.get("/api/keys", headers={"X-API-Key": alice_key})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_cannot_deactivate_self(client_and_admin):
    client, admin_key, admin = client_and_admin

    resp = await client.delete(f"/api/users/{admin.id}", headers={"X-API-Key": admin_key})
    assert resp.status_code == 400
    assert "Cannot deactivate your own account" in resp.json()["detail"]
