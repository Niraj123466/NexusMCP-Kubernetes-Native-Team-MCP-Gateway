"""Factory to dynamically instantiate LLM client based on configuration."""
from __future__ import annotations

from gateway.agent.base import LLMClient
from gateway.config import settings


def get_llm_client() -> LLMClient:
    """Return configured LLM provider client (Gemini or Ollama)."""
    provider = settings.llm_provider.lower().strip()
    if provider == "ollama":
        from gateway.agent.ollama_adapter import OllamaAdapter
        return OllamaAdapter()
    else:
        from gateway.agent.gemini_adapter import GeminiAdapter
        return GeminiAdapter()
