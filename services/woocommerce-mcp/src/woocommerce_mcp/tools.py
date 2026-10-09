"""WooCommerce MCP tools definitions and implementation."""
from __future__ import annotations

from typing import Any
import structlog

from woocommerce_mcp.wc_client import WooCommerceClient

log = structlog.get_logger(__name__)
_client = WooCommerceClient()


async def list_products(
    page: int = 1,
    per_page: int = 10,
    search: str | None = None,
    category: str | None = None,
) -> list[dict[str, Any]]:
    """
    List products from WooCommerce catalog.

    Args:
        page: Page number (1-based, default 1).
        per_page: Number of items per page (1-100, default 10).
        search: Optional search term to filter products by title or description.
        category: Optional category slug or ID to filter products.

    Returns:
        A list of product objects containing id, name, price, stock status, and categories.
    """
    try:
        products = await _client.list_products(
            page=page, per_page=per_page, search=search, category=category
        )
        # Summarize product data to keep MCP responses concise and relevant
        return [
            {
                "id": p.get("id"),
                "name": p.get("name"),
                "slug": p.get("slug"),
                "status": p.get("status"),
                "price": p.get("price"),
                "regular_price": p.get("regular_price"),
                "manage_stock": p.get("manage_stock"),
                "stock_quantity": p.get("stock_quantity"),
                "stock_status": p.get("stock_status"),
                "categories": [c.get("name") for c in p.get("categories", [])],
                "permalink": p.get("permalink"),
            }
            for p in products
        ]
    except Exception as exc:
        log.error("list_products_error", error=str(exc))
        raise RuntimeError(f"Failed to list products: {exc}") from exc


async def get_product(product_id: int) -> dict[str, Any]:
    """
    Retrieve full details for a single product by its WooCommerce ID.

    Args:
        product_id: The unique ID of the product.

    Returns:
        Product details including description, SKU, pricing, and attributes.
    """
    try:
        p = await _client.get_product(product_id)
        return {
            "id": p.get("id"),
            "name": p.get("name"),
            "sku": p.get("sku"),
            "price": p.get("price"),
            "regular_price": p.get("regular_price"),
            "sale_price": p.get("sale_price"),
            "description": p.get("description"),
            "short_description": p.get("short_description"),
            "manage_stock": p.get("manage_stock"),
            "stock_quantity": p.get("stock_quantity"),
            "stock_status": p.get("stock_status"),
            "categories": [c.get("name") for c in p.get("categories", [])],
            "tags": [t.get("name") for t in p.get("tags", [])],
            "permalink": p.get("permalink"),
        }
    except Exception as exc:
        log.error("get_product_error", product_id=product_id, error=str(exc))
        raise RuntimeError(f"Failed to get product {product_id}: {exc}") from exc


async def create_product(
    name: str,
    regular_price: str,
    description: str = "",
    short_description: str = "",
    manage_stock: bool = False,
    stock_quantity: int | None = None,
) -> dict[str, Any]:
    """
    Create a new product in the WooCommerce store.

    Args:
        name: Product title / name.
        regular_price: Price of the product (e.g. '19.99').
        description: Full HTML or text product description.
        short_description: Brief summary description.
        manage_stock: Whether stock management is enabled.
        stock_quantity: Available inventory count if manage_stock is True.

    Returns:
        Created product summary with newly assigned ID.
    """
    payload: dict[str, Any] = {
        "name": name,
        "type": "simple",
        "regular_price": regular_price,
        "description": description,
        "short_description": short_description,
        "manage_stock": manage_stock,
    }
    if manage_stock and stock_quantity is not None:
        payload["stock_quantity"] = stock_quantity
        payload["stock_status"] = "instock" if stock_quantity > 0 else "outofstock"

    try:
        p = await _client.create_product(payload)
        return {
            "id": p.get("id"),
            "name": p.get("name"),
            "price": p.get("price"),
            "regular_price": p.get("regular_price"),
            "stock_quantity": p.get("stock_quantity"),
            "permalink": p.get("permalink"),
            "status": "created",
        }
    except Exception as exc:
        log.error("create_product_error", name=name, error=str(exc))
        raise RuntimeError(f"Failed to create product '{name}': {exc}") from exc


async def update_product_stock(
    product_id: int,
    stock_quantity: int,
    stock_status: str = "instock",
) -> dict[str, Any]:
    """
    Update stock levels and status for an existing product.

    Args:
        product_id: Product ID.
        stock_quantity: New stock level count.
        stock_status: 'instock', 'outofstock', or 'onbackorder'.

    Returns:
        Updated product inventory summary.
    """
    payload: dict[str, Any] = {
        "manage_stock": True,
        "stock_quantity": stock_quantity,
        "stock_status": stock_status if stock_quantity > 0 else "outofstock",
    }
    try:
        p = await _client.update_product(product_id, payload)
        return {
            "id": p.get("id"),
            "name": p.get("name"),
            "manage_stock": p.get("manage_stock"),
            "stock_quantity": p.get("stock_quantity"),
            "stock_status": p.get("stock_status"),
            "status": "updated",
        }
    except Exception as exc:
        log.error("update_product_stock_error", product_id=product_id, error=str(exc))
        raise RuntimeError(f"Failed to update stock for product {product_id}: {exc}") from exc


async def list_orders(
    page: int = 1,
    per_page: int = 10,
    status: str | None = None,
    customer_id: int | None = None,
) -> list[dict[str, Any]]:
    """
    List orders from the store with optional status filter.

    Args:
        page: Page number (1-based, default 1).
        per_page: Number of orders per page (1-100, default 10).
        status: Order status (e.g. 'pending', 'processing', 'completed', 'cancelled').
        customer_id: Optional customer ID filter.

    Returns:
        List of order summaries including customer, items, and total amount.
    """
    try:
        orders = await _client.list_orders(
            page=page, per_page=per_page, status=status, customer_id=customer_id
        )
        return [
            {
                "id": o.get("id"),
                "status": o.get("status"),
                "currency": o.get("currency"),
                "total": o.get("total"),
                "billing": {
                    "first_name": o.get("billing", {}).get("first_name"),
                    "last_name": o.get("billing", {}).get("last_name"),
                    "email": o.get("billing", {}).get("email"),
                },
                "line_items": [
                    {
                        "product_id": item.get("product_id"),
                        "name": item.get("name"),
                        "quantity": item.get("quantity"),
                        "total": item.get("total"),
                    }
                    for item in o.get("line_items", [])
                ],
                "date_created": o.get("date_created"),
            }
            for o in orders
        ]
    except Exception as exc:
        log.error("list_orders_error", error=str(exc))
        raise RuntimeError(f"Failed to list orders: {exc}") from exc
