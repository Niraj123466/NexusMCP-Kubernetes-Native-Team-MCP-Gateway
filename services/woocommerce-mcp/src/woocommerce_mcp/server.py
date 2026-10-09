"""FastMCP Server for WooCommerce operations over Streamable HTTP."""
from __future__ import annotations

import logging
import structlog
from fastmcp import FastMCP

from woocommerce_mcp.config import settings
from woocommerce_mcp.tools import (
    create_product,
    get_product,
    list_orders,
    list_products,
    update_product_stock,
)

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.log_level.upper(), logging.INFO)
    ),
)
log = structlog.get_logger(__name__)

# Initialize FastMCP server
mcp = FastMCP("woocommerce-mcp")

# Register tools
mcp.tool()(list_products)
mcp.tool()(get_product)
mcp.tool()(create_product)
mcp.tool()(update_product_stock)
mcp.tool()(list_orders)


def run() -> None:
    """Run the WooCommerce FastMCP server."""
    log.info(
        "starting_woocommerce_mcp",
        host=settings.host,
        port=settings.port,
        wc_url=settings.wc_url,
    )
    # FastMCP run with http transport (Streamable HTTP)
    mcp.run(
        transport="http",
        host=settings.host,
        port=settings.port,
    )


if __name__ == "__main__":
    run()
