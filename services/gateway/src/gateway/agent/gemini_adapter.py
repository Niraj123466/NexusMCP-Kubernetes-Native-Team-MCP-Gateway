"""Google Gemini adapter using the new google-genai SDK."""
from __future__ import annotations

import json
import uuid
from typing import Any
import structlog

from gateway.agent.base import LLMClient, LLMMessage, LLMResponse, ToolCall
from gateway.config import settings

log = structlog.get_logger(__name__)


class GeminiAdapter(LLMClient):
    """Adapter for Google Gemini models via google-genai SDK."""

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        from google import genai

        self.api_key = api_key or settings.gemini_api_key
        if not self.api_key or self.api_key.startswith("your-gemini"):
            raise ValueError(
                "GEMINI_API_KEY is not configured. Please provide a valid Gemini API key in .env or switch LLM_PROVIDER=ollama."
            )
        self.model = model or settings.gemini_model
        self.client = genai.Client(api_key=self.api_key)

    async def generate(
        self,
        messages: list[LLMMessage],
        tools: list[dict[str, Any]],
        system_prompt: str | None = None,
    ) -> LLMResponse:
        from google.genai import types

        # 1. Convert tools to Gemini function declarations
        gemini_tools = []
        if tools:
            func_decls = []
            for t in tools:
                schema = t.get("inputSchema", {})
                # Clean up json schema for Gemini
                clean_schema = dict(schema)
                clean_schema.pop("$schema", None)
                clean_schema.pop("additionalProperties", None)

                func_decls.append(
                    types.FunctionDeclaration(
                        name=t["name"],
                        description=t.get("description", ""),
                        parameters=clean_schema,
                    )
                )
            gemini_tools.append(types.Tool(function_declarations=func_decls))

        # 2. Build contents
        contents: list[types.Content] = []
        for msg in messages:
            if msg.role == "system":
                continue  # System prompt passed in config
            elif msg.role == "user":
                contents.append(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=msg.content or "")],
                    )
                )
            elif msg.role == "assistant":
                parts: list[types.Part] = []
                if msg.content:
                    parts.append(types.Part.from_text(text=msg.content))
                if msg.tool_calls:
                    for tc in msg.tool_calls:
                        parts.append(
                            types.Part.from_function_call(
                                name=tc.name,
                                args=tc.arguments,
                            )
                        )
                if parts:
                    contents.append(types.Content(role="model", parts=parts))
            elif msg.role == "tool":
                # Function response part
                tool_res = json.loads(msg.content) if isinstance(msg.content, str) else (msg.content or {})
                contents.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=msg.name or "unknown_tool",
                                response={"response": tool_res},
                            )
                        ],
                    )
                )

        # 3. Configure call
        config = types.GenerateContentConfig(
            system_instruction=system_prompt or "You are an intelligent assistant with access to tools through NexusMCP Gateway.",
            tools=gemini_tools if gemini_tools else None,
            temperature=0.2,
        )

        try:
            resp = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=config,
            )
        except Exception as exc:
            log.error("gemini_api_call_failed", model=self.model, error=str(exc))
            raise RuntimeError(f"Gemini API request failed: {exc}") from exc

        # 4. Parse response
        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []

        if resp.candidates:
            candidate = resp.candidates[0]
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if part.text:
                        text_parts.append(part.text)
                    if part.function_call:
                        call = part.function_call
                        args = dict(call.args) if call.args else {}
                        tool_calls.append(
                            ToolCall(
                                id=str(uuid.uuid4().hex[:8]),
                                name=call.name,
                                arguments=args,
                            )
                        )

        return LLMResponse(
            content="".join(text_parts).strip() if text_parts else None,
            tool_calls=tool_calls,
        )
