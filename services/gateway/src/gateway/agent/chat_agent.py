"""AI Chat Agent — multi-turn tool execution loop using gateway's aggregated MCP tools."""
from __future__ import annotations

import json
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from gateway.agent.base import LLMClient, LLMMessage, ToolCall
from gateway.agent.factory import get_llm_client
from gateway.config import settings
from gateway.db.models import User
from gateway.mcp.aggregator import aggregator

log = structlog.get_logger(__name__)

SYSTEM_PROMPT = """You are NexusMCP AI Agent, an intelligent assistant running inside the NexusMCP Team Gateway platform.
You have access to tools registered from upstream MCP servers (such as WooCommerce store management, Time utilities, and Web Fetching).
When answering questions or performing user tasks, invoke the available tools accurately.
Always execute operations using the authenticated user's identity.
When presenting results, be clear, structured, and helpful.
"""


class ChatAgent:
    """Orchestrates conversations with LLM and executes tool calls through MCP aggregator."""

    def __init__(self, client: LLMClient | None = None) -> None:
        self._client = client

    def get_client(self) -> LLMClient:
        return self._client or get_llm_client()

    async def run(
        self,
        db: AsyncSession,
        user: User,
        input_messages: list[dict[str, Any]],
        system_prompt: str | None = None,
    ) -> dict[str, Any]:
        """
        Execute the chat loop until LLM provides a final text response or hits iteration limit.
        """
        client = self.get_client()

        # 1. Discover all tools accessible to this user
        available_tools = await aggregator.list_all_tools(db, user)
        log.info(
            "chat_agent_tools_discovered",
            user=user.username,
            tool_count=len(available_tools),
        )

        # 2. Build message list
        messages: list[LLMMessage] = []
        for m in input_messages:
            messages.append(
                LLMMessage(
                    role=m.get("role", "user"),
                    content=m.get("content"),
                    tool_calls=[ToolCall(**tc) for tc in m.get("tool_calls", [])] if m.get("tool_calls") else None,
                    tool_call_id=m.get("tool_call_id"),
                    name=m.get("name"),
                )
            )

        executed_tools: list[dict[str, Any]] = []
        iterations = 0
        max_iterations = settings.chat_max_tool_iterations

        while iterations < max_iterations:
            iterations += 1
            log.info("chat_agent_iteration", iteration=iterations, user=user.username)

            resp = await client.generate(
                messages=messages,
                tools=available_tools,
                system_prompt=system_prompt or SYSTEM_PROMPT,
            )

            # Case A: Model requested tool calls
            if resp.has_tool_calls:
                # Append assistant message with tool calls
                messages.append(
                    LLMMessage(
                        role="assistant",
                        content=resp.content,
                        tool_calls=resp.tool_calls,
                    )
                )

                # Execute each requested tool
                for tc in resp.tool_calls:
                    log.info("chat_agent_executing_tool", tool=tc.name, user=user.username)
                    try:
                        tool_result = await aggregator.execute_tool(
                            db=db,
                            user=user,
                            namespaced_tool=tc.name,
                            arguments=tc.arguments,
                        )
                        result_str = json.dumps(tool_result, ensure_ascii=False)
                        executed_tools.append({
                            "name": tc.name,
                            "arguments": tc.arguments,
                            "result": tool_result,
                            "status": "success",
                        })
                    except Exception as err:
                        log.error("chat_agent_tool_failed", tool=tc.name, error=str(err))
                        result_str = json.dumps({"error": str(err)})
                        executed_tools.append({
                            "name": tc.name,
                            "arguments": tc.arguments,
                            "error": str(err),
                            "status": "error",
                        })

                    # Append tool result message
                    messages.append(
                        LLMMessage(
                            role="tool",
                            name=tc.name,
                            tool_call_id=tc.id,
                            content=result_str,
                        )
                    )
                # Continue loop to allow model to observe results
                continue

            # Case B: Model returned final text answer
            messages.append(
                LLMMessage(
                    role="assistant",
                    content=resp.content or "",
                )
            )
            break

        final_assistant_content = resp.content or ""
        return {
            "message": {
                "role": "assistant",
                "content": final_assistant_content,
            },
            "tool_executions": executed_tools,
            "iterations": iterations,
            "messages": [m.model_dump() for m in messages],
        }


chat_agent = ChatAgent()
