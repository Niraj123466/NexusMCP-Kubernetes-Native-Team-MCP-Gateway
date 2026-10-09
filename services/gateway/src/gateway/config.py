"""Gateway configuration — loaded from environment variables / Kubernetes Secrets."""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Database ──────────────────────────────────────────────
    postgres_host: str = Field("localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(5432, alias="POSTGRES_PORT")
    postgres_db: str = Field("nexusmcp", alias="POSTGRES_DB")
    postgres_user: str = Field("nexusmcp", alias="POSTGRES_USER")
    postgres_password: str = Field("change-me-strong-password", alias="POSTGRES_PASSWORD")

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        """For Alembic migrations (synchronous)."""
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # ── Security ──────────────────────────────────────────────
    gateway_secret_key: str = Field(
        "nexusmcp-gateway-default-insecure-secret-key-32chars",
        alias="GATEWAY_SECRET_KEY",
    )

    # ── LLM ──────────────────────────────────────────────────
    llm_provider: str = Field("gemini", alias="LLM_PROVIDER")  # gemini | ollama
    gemini_api_key: str = Field("", alias="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-2.0-flash", alias="GEMINI_MODEL")
    ollama_base_url: str = Field("http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_model: str = Field("llama3.1", alias="OLLAMA_MODEL")

    # ── MCP Upstreams (default cluster-internal URLs) ─────────
    woocommerce_mcp_url: str = Field("http://woocommerce-mcp-svc:8001/mcp", alias="WOOCOMMERCE_MCP_URL")
    time_mcp_url: str = Field("http://time-mcp-svc:8002/mcp", alias="TIME_MCP_URL")
    fetch_mcp_url: str = Field("http://fetch-mcp-svc:8003/mcp", alias="FETCH_MCP_URL")

    # ── SSRF guard ────────────────────────────────────────────
    ssrf_internal_allowlist: str = Field(
        "woocommerce-mcp-svc,time-mcp-svc,fetch-mcp-svc",
        alias="SSRF_INTERNAL_ALLOWLIST",
    )

    @property
    def ssrf_allowed_hosts(self) -> list[str]:
        return [h.strip() for h in self.ssrf_internal_allowlist.split(",") if h.strip()]

    # ── Logging ───────────────────────────────────────────────
    log_level: str = Field("INFO", alias="LOG_LEVEL")

    # ── Chat agent limits ─────────────────────────────────────
    chat_max_tool_iterations: int = 10


settings = Settings()  # type: ignore[call-arg]
