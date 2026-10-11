"""Ollama adapter using OpenAI-compatible client for local LLM inference."""
from __future__ import annotations

import json
from typing import Any
import structlog
from openai import AsyncOpenAI

from gateway.agent.base import LLMClient, LLMMessage, LLMResponse, ToolCall
from gateway.config import settings

log = structlog.get_logger(__name__)


class OllamaAdapter(LLMClient):
    """Adapter for Ollama using its OpenAI-compatible /v1 endpoint."""

    def __init__(self, base_url: str | None = None, model: str | None = None) -> None:
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        if not self.base_url.endswith("/v1"):
            self.base_url = f"{self.base_url}/v1"
        self.model = model or settings.ollama_model
        self.client = AsyncOpenAI(
            base_url=self.base_url,
            api_key="ollama",  # dummy key required by OpenAI client
        )

    async def generate(
        self,
        messages: list[LLMMessage],
        tools: list[dict[str, Any]],
        system_prompt: str | None = None,
    ) -> LLMResponse:
        # 1. Format tools
        openai_tools = None
        if tools:
            openai_tools = [
                {
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": t.get("description", ""),
                        "parameters": t.get("inputSchema", {"type": "object"}),
                    },
                }
                for t in tools
            ]

        # 2. Format messages
        openai_messages = []
        if system_prompt:
            openai_messages.append({"role": "system", "content": system_prompt})

        for m in messages:
            msg_dict: dict[str, Any] = {"role": m.role}
            if m.content is not None:
                msg_dict["content"] = m.content

            if m.tool_calls:
                msg_dict["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments),
                        },
                    }
                    for tc in m.tool_calls
                ]

            if m.tool_call_id:
                msg_dict["tool_call_id"] = m.tool_call_id
            if m.name:
                msg_dict["name"] = m.name

            openai_messages.append(msg_dict)

        try:
            kwargs: dict[str, Any] = {
                "model": self.model,
                "messages": openai_messages,
                "temperature": 0.2,
            }
            if openai_tools:
                kwargs["tools"] = openai_tools

            resp = await self.client.chat.completions.create(**kwargs)
        except Exception as exc:
            log.error("ollama_api_call_failed", model=self.model, base_url=self.base_url, error=str(exc))
            raise RuntimeError(f"Ollama request failed: {exc}") from exc

        choice = resp.choices[0]
        choice_msg = choice.message

        tool_calls: list[ToolCall] = []
        if choice_msg.tool_calls:
            for tc in choice_msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments) if tc.function.arguments else {}
                except Exception:
                    args = {}
                tool_calls.append(
                    ToolCall(
                        id=tc.id,
                        name=tc.function.name,
                        arguments=args,
                    )
                )

        return LLMResponse(
            content=choice_msg.content,
            tool_calls=tool_calls,
        )
