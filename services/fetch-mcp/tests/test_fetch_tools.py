"""Unit tests for Fetch MCP tools and SSRF guard."""
from unittest.mock import AsyncMock, patch
import pytest

from fetch_mcp.ssrf_guard import SSRFValidationError, validate_url
from fetch_mcp.tools import fetch_url


def test_ssrf_rejects_non_http_schemes():
    with pytest.raises(SSRFValidationError) as exc:
        validate_url("file:///etc/passwd")
    assert "scheme" in str(exc.value)

    with pytest.raises(SSRFValidationError) as exc:
        validate_url("ftp://example.com/file")
    assert "scheme" in str(exc.value)


def test_ssrf_rejects_localhost():
    with pytest.raises(SSRFValidationError) as exc:
        validate_url("http://localhost:8000/api")
    assert "localhost" in str(exc.value)


def test_ssrf_rejects_private_ips():
    # 127.0.0.1 loopback
    with pytest.raises(SSRFValidationError):
        validate_url("http://127.0.0.1:8080")

    # 10.x private
    with pytest.raises(SSRFValidationError):
        validate_url("http://10.0.0.1")

    # 192.168.x private
    with pytest.raises(SSRFValidationError):
        validate_url("http://192.168.1.1")

    # 172.16.x private
    with pytest.raises(SSRFValidationError):
        validate_url("http://172.16.0.1")


def test_ssrf_rejects_cloud_metadata():
    with pytest.raises(SSRFValidationError):
        validate_url("http://169.254.169.254/latest/meta-data/")


@pytest.mark.asyncio
async def test_fetch_url_blocked_by_ssrf():
    with pytest.raises(RuntimeError) as exc:
        await fetch_url("http://127.0.0.1:9090")
    assert "SSRF guard blocked request" in str(exc.value)


@pytest.mark.asyncio
async def test_fetch_url_disallowed_method():
    with pytest.raises(ValueError) as exc:
        await fetch_url("https://example.com", method="DELETE")
    assert "not allowed" in str(exc.value)


@pytest.mark.asyncio
async def test_fetch_url_success_mock():
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.url = "https://example.com/page"
    mock_resp.headers = {"content-type": "text/html"}
    mock_resp.text = "<html><body>Hello World</body></html>"
    mock_resp.is_redirect = False

    with patch("fetch_mcp.tools.validate_url", return_value="https://example.com/page"):
        with patch("httpx.AsyncClient.request", new=AsyncMock(return_value=mock_resp)):
            res = await fetch_url("https://example.com/page")
            assert res["status_code"] == 200
            assert "Hello World" in res["content"]
            assert res["content_type"] == "text/html"
