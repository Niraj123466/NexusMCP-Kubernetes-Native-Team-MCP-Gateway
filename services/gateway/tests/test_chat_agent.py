"""Unit and integration tests for AI Chat Agent and /api/chat router."""
from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from gateway.agent.base import LLMClient, LLMMessage, LLMResponse, ToolCall
from gateway.agent.chat_agent import ChatAgent
from gateway.auth.api_keys import generate_api_key
from gateway.db.models import ApiKey, AuditLog, Base, UpstreamServer, User, UserRole
from gateway.db.session import get_db
from gateway.main import app


class MockLLMClient(LLMClient):
    """Mock LLM client that can simulate tool calling followed by final answer."""

    def __init__(self, responses: list[LLMResponse]) -> None:
        self.responses = list(responses)
        self.call_count = 0

    async def generate(
        self,
        messages: list[LLMMessage],
        tools: list[dict],
        system_prompt: str | None = None,
    ) -> LLMResponse:
        resp = self.responses[self.call_count]
        self.call_count += 1
        return resp


@pytest.fixture
async def chat_test_env():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Seed User
        user_key, user_hash, user_prefix = generate_api_key()
        user = User(username="alice", email="alice@nexusmcp.local", role=UserRole.member)
        session.add(user)
        await session.flush()
        session.add(ApiKey(user_id=user.id, name="Alice Key", prefix=user_prefix, key_hash=user_hash))

        # Seed Upstream
        upstream = UpstreamServer(
            slug="time",
            name="Time Service",
            url="http://time-mcp-svc:8002/mcp",
            enabled=True,
            created_by=user.id,
        )
        session.add(upstream)
        await session.commit()

        async def override_get_db():
            yield session

        app.dependency_overrides[get_db] = override_get_db

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, user_key, user, session

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_chat_agent_tool_calling_loop(chat_test_env):
    client, user_key, user, session = chat_test_env

    # Setup 2-step mock LLM:
    # 1st call: request time__get_current_time
    # 2nd call: answer with the time
    mock_responses = [
        LLMResponse(
            content="Let me check the time for you.",
            tool_calls=[
                ToolCall(
                    id="call_1",
                    name="time__get_current_time",
                    arguments={"timezone": "UTC"},
                )
            ],
        ),
        LLMResponse(
            content="The current time in UTC is 12:00:00.",
            tool_calls=[],
        ),
    ]
    mock_llm = MockLLMClient(mock_responses)
    agent = ChatAgent(client=mock_llm)

    mock_tool_result = {"content": [{"type": "text", "text": '{"time": "12:00:00"}'}], "isError": False}

    with patch("gateway.mcp.aggregator.UpstreamClient.list_tools", new=AsyncMock(return_value=[{"name": "get_current_time"}])):
        with patch("gateway.mcp.aggregator.UpstreamClient.call_tool", new=AsyncMock(return_value=mock_tool_result)):
            res = await agent.run(
                db=session,
                user=user,
                input_messages=[{"role": "user", "content": "What time is it in UTC?"}],
            )

    assert res["iterations"] == 2
    assert "The current time in UTC is 12:00:00." in res["message"]["content"]
    assert len(res["tool_executions"]) == 1
    assert res["tool_executions"][0]["name"] == "time__get_current_time"

    # Verify audit log was recorded
    audit_res = await session.execute(select(AuditLog).where(AuditLog.user_id == user.id))
    logs = list(audit_res.scalars().all())
    assert len(logs) == 1
    assert logs[0].tool_name == "time__get_current_time"
    assert logs[0].outcome == "success"


@pytest.mark.asyncio
async def test_chat_api_endpoint(chat_test_env):
    client, user_key, user, session = chat_test_env

    mock_response = LLMResponse(content="Hello! I am NexusMCP agent.", tool_calls=[])
    mock_llm = MockLLMClient([mock_response])

    with patch("gateway.agent.chat_agent.chat_agent.get_client", return_value=mock_llm):
        resp = await client.post(
            "/api/chat",
            headers={"X-API-Key": user_key},
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["message"]["content"] == "Hello! I am NexusMCP agent."
    assert data["iterations"] == 1
    assert data["tool_executions"] == []
