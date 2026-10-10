"""Time MCP Server configuration."""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    host: str = Field("0.0.0.0", alias="HOST")
    port: int = Field(8002, alias="PORT")
    log_level: str = Field("INFO", alias="LOG_LEVEL")


settings = Settings()
