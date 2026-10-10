"""FastMCP Server for Time operations over Streamable HTTP."""
from __future__ import annotations

import logging
import structlog
from fastmcp import FastMCP

from time_mcp.config import settings
from time_mcp.tools import get_current_time, list_timezones

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.log_level.upper(), logging.INFO)
    ),
)
log = structlog.get_logger(__name__)

mcp = FastMCP("time-mcp")

# Register tools
mcp.tool()(get_current_time)
mcp.tool()(list_timezones)


def run() -> None:
    """Run the Time FastMCP server."""
    log.info(
        "starting_time_mcp",
        host=settings.host,
        port=settings.port,
    )
    mcp.run(
        transport="http",
        host=settings.host,
        port=settings.port,
    )


if __name__ == "__main__":
    run()
