"""SQLAlchemy ORM models for the NexusMCP platform database."""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ── Enums ─────────────────────────────────────────────────────

class UserRole(str, Enum):
    admin = "admin"
    member = "member"


class UpstreamAuthType(str, Enum):
    none = "none"
    bearer = "bearer"
    header = "header"


class AuditOutcome(str, Enum):
    success = "success"
    error = "error"
    denied = "denied"
    timeout = "timeout"


# ── Models ────────────────────────────────────────────────────

class User(Base):
    """Platform user — admin or member."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default=UserRole.member)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    api_keys: Mapped[list[ApiKey]] = relationship("ApiKey", back_populates="user", lazy="select")
    audit_logs: Mapped[list[AuditLog]] = relationship("AuditLog", back_populates="user", lazy="select")


class ApiKey(Base):
    """
    Issued API keys for users.

    The plaintext key is shown ONCE at issuance.
    Only the bcrypt hash is persisted here — never the plaintext.
    The `prefix` (first 8 chars) is used for identification in UI and logs.
    """

    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)  # human label
    prefix: Mapped[str] = mapped_column(String(8), nullable=False)   # first 8 chars of plaintext key
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False)  # bcrypt hash
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship("User", back_populates="api_keys")

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None


class UpstreamServer(Base):
    """
    Registered upstream MCP server.

    auth_value_enc stores an AES-256-GCM encrypted copy of the credential
    (bearer token or raw header value). Never returned to clients in plaintext.
    """

    __tablename__ = "upstream_servers"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    auth_type: Mapped[str] = mapped_column(
        String(16), nullable=False, default=UpstreamAuthType.none
    )
    auth_header_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    auth_value_enc: Mapped[str | None] = mapped_column(Text, nullable=True)  # encrypted
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    audit_logs: Mapped[list[AuditLog]] = relationship(
        "AuditLog", back_populates="upstream", lazy="select"
    )


class AuditLog(Base):
    """
    Immutable record of every tool call through the gateway.

    args_hash is an HMAC-SHA256 of the raw arguments — lets auditors verify
    integrity without storing PII or secrets in plaintext.
    """

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False, index=True
    )
    upstream_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("upstream_servers.id"), nullable=True, index=True
    )
    tool_name: Mapped[str] = mapped_column(String(255), nullable=False)
    args_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # HMAC-SHA256 hex
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)  # AuditOutcome
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    user: Mapped[User] = relationship("User", back_populates="audit_logs")
    upstream: Mapped[UpstreamServer | None] = relationship(
        "UpstreamServer", back_populates="audit_logs"
    )


class ToolPermission(Base):
    """
    Optional fine-grained tool-level permissions.

    If no row exists for a (user, tool), access defaults to allowed for members.
    An explicit allowed=False row denies access regardless of role.
    """

    __tablename__ = "tool_permissions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    upstream_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("upstream_servers.id", ondelete="CASCADE"),
        nullable=False,
    )
    tool_name: Mapped[str] = mapped_column(String(255), nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
