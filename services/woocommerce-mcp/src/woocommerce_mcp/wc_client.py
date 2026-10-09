"""WooCommerce REST API client using httpx."""
from __future__ import annotations

from typing import Any
import httpx
import structlog

from woocommerce_mcp.config import settings

log = structlog.get_logger(__name__)


class WooCommerceClient:
    """Async client interacting with WooCommerce REST API v3."""

    def __init__(
        self,
        base_url: str | None = None,
        consumer_key: str | None = None,
        consumer_secret: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = (base_url or settings.wc_url).rstrip("/")
        self.consumer_key = consumer_key or settings.wc_consumer_key
        self.consumer_secret = consumer_secret or settings.wc_consumer_secret
        self.timeout = timeout or settings.wc_timeout_seconds

    def _client(self) -> httpx.AsyncClient:
        # Pass auth as Basic Auth with X-Forwarded-Proto for internal cluster networking
        return httpx.AsyncClient(
            base_url=self.base_url,
            auth=(self.consumer_key, self.consumer_secret),
            timeout=self.timeout,
            headers={
                "User-Agent": "NexusMCP-WooCommerce/0.1.0",
                "X-Forwarded-Proto": "https",
            },
        )

    def _auth_params(self) -> dict[str, str]:
        # Over plain HTTP (internal k8s), WooCommerce requires query param auth fallback
        return {
            "consumer_key": self.consumer_key,
            "consumer_secret": self.consumer_secret,
        }

    async def list_products(
        self,
        page: int = 1,
        per_page: int = 10,
        search: str | None = None,
        category: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        """List products with pagination and optional search/category filters."""
        params: dict[str, Any] = {
            **self._auth_params(),
            "page": max(1, page),
            "per_page": min(100, max(1, per_page)),
        }
        if search:
            params["search"] = search
        if category:
            params["category"] = category
        if status:
            params["status"] = status

        async with self._client() as client:
            resp = await client.get("/products", params=params)
            resp.raise_for_status()
            data: list[dict[str, Any]] = resp.json()
            return data

    async def get_product(self, product_id: int) -> dict[str, Any]:
        """Fetch a single product by ID."""
        async with self._client() as client:
            resp = await client.get(f"/products/{product_id}", params=self._auth_params())
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            return data

    async def create_product(self, product_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new product."""
        async with self._client() as client:
            resp = await client.post(
                "/products",
                params=self._auth_params(),
                json=product_data,
            )
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            return data

    async def update_product(self, product_id: int, product_data: dict[str, Any]) -> dict[str, Any]:
        """Update an existing product."""
        async with self._client() as client:
            resp = await client.put(
                f"/products/{product_id}",
                params=self._auth_params(),
                json=product_data,
            )
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
            return data

    async def list_orders(
        self,
        page: int = 1,
        per_page: int = 10,
        status: str | None = None,
        customer_id: int | None = None,
    ) -> list[dict[str, Any]]:
        """List orders with pagination and optional filters."""
        params: dict[str, Any] = {
            **self._auth_params(),
            "page": max(1, page),
            "per_page": min(100, max(1, per_page)),
        }
        if status:
            params["status"] = status
        if customer_id:
            params["customer"] = customer_id

        async with self._client() as client:
            resp = await client.get("/orders", params=params)
            resp.raise_for_status()
            data: list[dict[str, Any]] = resp.json()
            return data
