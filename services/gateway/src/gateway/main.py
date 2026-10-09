"""
NexusMCP Gateway — FastAPI application entry point.

Lifecycle:
  startup  → run Alembic migrations → seed first admin if DB is empty
  shutdown → dispose DB connections

Routers mounted:
  /api/users   — user management
  /api/keys    — API key issuance and revocation
  /api/upstreams — upstream MCP server registry  (Phase 4)
  /api/audit   — audit log viewer                (Phase 4)
  /api/chat    — AI chat agent                   (Phase 5)
  /mcp         — MCP proxy endpoint              (Phase 4)
"""
from __future__ import annotations

import logging

import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from gateway.config import settings
from gateway.db.models import Base, User, UserRole
from gateway.db.session import AsyncSessionLocal, engine
from gateway.routers import keys, users

# ── Structured logging ────────────────────────────────────────
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.log_level.upper(), logging.INFO)
    ),
)
log = structlog.get_logger(__name__)


# ── Lifespan ──────────────────────────────────────────────────

async def _run_migrations() -> None:
    """Run Alembic migrations at startup (sync via subprocess)."""
    import asyncio

    proc = await asyncio.create_subprocess_exec(
        "alembic", "upgrade", "head",
        cwd="/app",  # set by Dockerfile; works locally too if run from services/gateway/
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        log.error("alembic_migration_failed", stderr=stderr.decode())
        raise RuntimeError("Database migration failed.")
    log.info("alembic_migration_ok", output=stdout.decode().strip())


async def _seed_admin() -> None:
    """Create the first admin user and issue an initial API key if the users table is empty."""
    import os
    from gateway.auth.api_keys import _hash_key, generate_api_key
    from gateway.db.models import ApiKey

    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar_one()
        if count == 0:
            admin = User(
                username="admin",
                email="admin@nexusmcp.local",
                role=UserRole.admin,
            )
            db.add(admin)
            await db.flush()

            # Check if there is a predefined admin key in env or generate a new one
            env_key = os.getenv("ADMIN_INITIAL_API_KEY")
            if env_key:
                raw_key = env_key
                prefix = raw_key[:8]
                key_hash = _hash_key(raw_key)
            else:
                raw_key, key_hash, prefix = generate_api_key()

            admin_key = ApiKey(
                user_id=admin.id,
                name="Initial Bootstrap Key",
                prefix=prefix,
                key_hash=key_hash,
            )
            db.add(admin_key)
            await db.commit()
            log.info("seeded_first_admin", username="admin", admin_api_key=raw_key)


from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ── startup ──────────────────────────────────────────────
    log.info("gateway_starting", llm_provider=settings.llm_provider)
    try:
        await _run_migrations()
    except Exception as exc:  # noqa: BLE001
        log.warning("migration_skipped", reason=str(exc))
        # Fall back: create tables directly if Alembic is not available
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    await _seed_admin()
    log.info("gateway_ready")

    yield  # ── running ───────────────────────────────────────

    # ── shutdown ─────────────────────────────────────────────
    await engine.dispose()
    log.info("gateway_shutdown")


# ── App ───────────────────────────────────────────────────────

app = FastAPI(
    title="NexusMCP Gateway",
    description="Team MCP Gateway — unified MCP endpoint, auth, audit, and AI chat.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # tighten in production via values-production.yaml env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(users.router)
app.include_router(keys.router)
# Future phases will add: upstreams, audit, chat, mcp proxy


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


if __name__ == "__main__":
    uvicorn.run("gateway.main:app", host="0.0.0.0", port=8000, reload=True)
