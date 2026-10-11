"""Base abstractions and data contracts for LLM providers."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel, Field


class ToolCall(BaseModel):
    id: str = Field(..., description="Unique ID for this tool call invocation")
    name: str = Field(..., description="Namespaced tool name")
    arguments: dict[str, Any] = Field(default_factory=dict, description="Parsed tool input arguments")


class LLMMessage(BaseModel):
    role: str = Field(..., description="system | user | assistant | tool")
    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None
    name: str | None = None


class LLMResponse(BaseModel):
    content: str | None = None
    tool_calls: list[ToolCall] = Field(default_factory=list)

    @property
    def has_tool_calls(self) -> bool:
        return len(self.tool_calls) > 0


class LLMClient(ABC):
    """Abstract interface implemented by all LLM adapters (Gemini, Ollama)."""

    @abstractmethod
    async def generate(
        self,
        messages: list[LLMMessage],
        tools: list[dict[str, Any]],
        system_prompt: str | None = None,
    ) -> LLMResponse:
        """Generate response from the model, optionally invoking tools."""
        ...
