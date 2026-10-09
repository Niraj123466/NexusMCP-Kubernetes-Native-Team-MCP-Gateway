FROM python:3.12-slim AS builder

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY pyproject.toml .
RUN uv pip compile pyproject.toml -o requirements.txt && \
    uv pip install --no-cache --target=/app/wheels -r requirements.txt

# ── Runtime Stage ──────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -s /bin/bash -m appuser

COPY --from=builder /app/wheels /usr/local/lib/python3.12/site-packages
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

COPY src src
COPY pyproject.toml .

RUN uv pip install --no-cache --system -e .

USER appuser

EXPOSE 8001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8001/mcp || exit 0

CMD ["python", "-m", "woocommerce_mcp.server"]
