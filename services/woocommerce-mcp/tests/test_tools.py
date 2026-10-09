"""Unit tests for WooCommerce MCP tools using unittest.mock."""
from unittest.mock import AsyncMock, patch
import pytest

from woocommerce_mcp.tools import (
    create_product,
    get_product,
    list_orders,
    list_products,
    update_product_stock,
)


@pytest.mark.asyncio
async def test_list_products_success():
    mock_data = [
        {
            "id": 42,
            "name": "Nexus T-Shirt",
            "slug": "nexus-t-shirt",
            "status": "publish",
            "price": "29.99",
            "regular_price": "29.99",
            "manage_stock": True,
            "stock_quantity": 100,
            "stock_status": "instock",
            "categories": [{"name": "Clothing"}],
            "permalink": "http://store.nexusmcp.local/product/nexus-t-shirt",
        }
    ]

    with patch("woocommerce_mcp.tools._client.list_products", new=AsyncMock(return_value=mock_data)):
        res = await list_products(page=1, per_page=5, search="Shirt")
        assert len(res) == 1
        assert res[0]["id"] == 42
        assert res[0]["name"] == "Nexus T-Shirt"
        assert res[0]["categories"] == ["Clothing"]
        assert res[0]["stock_quantity"] == 100


@pytest.mark.asyncio
async def test_get_product_success():
    mock_data = {
        "id": 99,
        "name": "Nexus Mug",
        "sku": "NEXUS-MUG-01",
        "price": "14.50",
        "regular_price": "14.50",
        "sale_price": "",
        "description": "<p>A nice ceramic mug</p>",
        "short_description": "Ceramic mug",
        "manage_stock": False,
        "stock_quantity": None,
        "stock_status": "instock",
        "categories": [{"name": "Accessories"}],
        "tags": [{"name": "Hot Drinks"}],
        "permalink": "http://store.nexusmcp.local/product/nexus-mug",
    }

    with patch("woocommerce_mcp.tools._client.get_product", new=AsyncMock(return_value=mock_data)):
        p = await get_product(99)
        assert p["id"] == 99
        assert p["sku"] == "NEXUS-MUG-01"
        assert p["price"] == "14.50"
        assert "Accessories" in p["categories"]


@pytest.mark.asyncio
async def test_create_product_success():
    mock_resp = {
        "id": 105,
        "name": "Hoodie with Logo",
        "price": "45.00",
        "regular_price": "45.00",
        "stock_quantity": 50,
        "permalink": "http://store.nexusmcp.local/product/hoodie",
    }

    with patch("woocommerce_mcp.tools._client.create_product", new=AsyncMock(return_value=mock_resp)) as mock_post:
        created = await create_product(
            name="Hoodie with Logo",
            regular_price="45.00",
            manage_stock=True,
            stock_quantity=50,
        )
        assert created["id"] == 105
        assert created["status"] == "created"
        assert created["stock_quantity"] == 50
        mock_post.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_product_stock_success():
    mock_resp = {
        "id": 105,
        "name": "Hoodie with Logo",
        "manage_stock": True,
        "stock_quantity": 25,
        "stock_status": "instock",
    }

    with patch("woocommerce_mcp.tools._client.update_product", new=AsyncMock(return_value=mock_resp)):
        updated = await update_product_stock(105, stock_quantity=25)
        assert updated["id"] == 105
        assert updated["stock_quantity"] == 25
        assert updated["status"] == "updated"


@pytest.mark.asyncio
async def test_list_orders_success():
    mock_orders = [
        {
            "id": 2001,
            "status": "processing",
            "currency": "USD",
            "total": "59.98",
            "billing": {
                "first_name": "Bob",
                "last_name": "Smith",
                "email": "bob@example.com",
            },
            "line_items": [
                {
                    "product_id": 42,
                    "name": "Nexus T-Shirt",
                    "quantity": 2,
                    "total": "59.98",
                }
            ],
            "date_created": "2026-10-09T10:00:00",
        }
    ]

    with patch("woocommerce_mcp.tools._client.list_orders", new=AsyncMock(return_value=mock_orders)):
        orders = await list_orders(status="processing")
        assert len(orders) == 1
        assert orders[0]["id"] == 2001
        assert orders[0]["billing"]["first_name"] == "Bob"
        assert len(orders[0]["line_items"]) == 1
        assert orders[0]["total"] == "59.98"


@pytest.mark.asyncio
async def test_error_handling():
    with patch("woocommerce_mcp.tools._client.get_product", new=AsyncMock(side_effect=Exception("API connection timeout"))):
        with pytest.raises(RuntimeError) as exc_info:
            await get_product(9999)
        assert "Failed to get product 9999" in str(exc_info.value)
