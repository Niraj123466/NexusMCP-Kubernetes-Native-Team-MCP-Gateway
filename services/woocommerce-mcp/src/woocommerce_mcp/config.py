"""WooCommerce MCP Server configuration."""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── WooCommerce REST API ────────────────────────────────────
    wc_url: str = Field("http://wordpress-svc/wp-json/wc/v3", alias="WC_URL")
    wc_consumer_key: str = Field("ck_test", alias="WC_CONSUMER_KEY")
    wc_consumer_secret: str = Field("cs_test", alias="WC_CONSUMER_SECRET")
    wc_timeout_seconds: float = Field(30.0, alias="WC_TIMEOUT_SECONDS")

    # ── Server ──────────────────────────────────────────────────
    host: str = Field("0.0.0.0", alias="HOST")
    port: int = Field(8001, alias="PORT")
    log_level: str = Field("INFO", alias="LOG_LEVEL")


settings = Settings()
