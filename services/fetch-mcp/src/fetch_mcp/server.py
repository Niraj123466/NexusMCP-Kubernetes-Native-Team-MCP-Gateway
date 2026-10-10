"""FastMCP Server for Fetch operations over Streamable HTTP."""
from __future__ import annotations

import logging
import structlog
from fastmcp import FastMCP

from fetch_mcp.config import settings
from fetch_mcp.tools import fetch_url

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.log_level.upper(), logging.INFO)
    ),
)
log = structlog.get_logger(__name__)

mcp = FastMCP("fetch-mcp")

# Register tools
mcp.tool()(fetch_url)


def run() -> None:
    """Run the Fetch FastMCP server."""
    log.info(
        "starting_fetch_mcp",
        host=settings.host,
        port=settings.port,
        allowed_domains=settings.allowed_domains,
    )
    mcp.run(
        transport="http",
        host=settings.host,
        port=settings.port,
    )


if __name__ == "__main__":
    run()
