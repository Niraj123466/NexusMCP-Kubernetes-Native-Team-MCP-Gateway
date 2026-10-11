"""AI Chat Agent API router."""
from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.agent.chat_agent import chat_agent
from gateway.auth.deps import get_current_user
from gateway.db.models import User
from gateway.db.session import get_db

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessageInput(BaseModel):
    role: str = Field(..., description="user | assistant | system | tool")
    content: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None
    name: str | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessageInput] = Field(..., min_length=1)
    system_prompt: str | None = None


class ChatResponse(BaseModel):
    message: dict[str, Any]
    tool_executions: list[dict[str, Any]]
    iterations: int
    messages: list[dict[str, Any]]


@router.post("", response_model=ChatResponse)
async def chat_endpoint(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Interact with the NexusMCP AI Agent.
    The agent calls tools using the authenticated user's identity and records audit logs.
    """
    raw_messages = [m.model_dump() for m in body.messages]
    try:
        result = await chat_agent.run(
            db=db,
            user=user,
            input_messages=raw_messages,
            system_prompt=body.system_prompt,
        )
        return result
    except ValueError as err:
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(err)) from err
