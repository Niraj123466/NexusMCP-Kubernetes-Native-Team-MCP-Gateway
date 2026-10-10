"""Fetch MCP Server configuration."""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    host: str = Field("0.0.0.0", alias="HOST")
    port: int = Field(8003, alias="PORT")
    allowed_domains: str = Field("", alias="FETCH_ALLOWED_DOMAINS")
    max_content_length: int = Field(500_000, alias="FETCH_MAX_CONTENT_LENGTH")
    timeout_seconds: float = Field(15.0, alias="FETCH_TIMEOUT_SECONDS")
    log_level: str = Field("INFO", alias="LOG_LEVEL")

    @property
    def domain_allowlist(self) -> list[str]:
        return [d.strip().lower() for d in self.allowed_domains.split(",") if d.strip()]


settings = Settings()
