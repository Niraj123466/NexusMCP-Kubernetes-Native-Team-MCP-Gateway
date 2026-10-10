"""SSRF Guard for Gateway outbound upstream connections."""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse
import structlog

from gateway.config import settings

log = structlog.get_logger(__name__)


class GatewaySSRFError(ValueError):
    """Raised when an upstream server URL fails SSRF security validation."""


def validate_upstream_url(url: str) -> str:
    """
    Validate that an upstream MCP server URL is safe to connect to:
    1. Scheme must be http or https
    2. Hostnames explicitly in settings.ssrf_allowed_hosts are allowed (cluster internal)
    3. Other external hostnames must resolve to public IP addresses (no private/loopback/metadata)
    """
    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https"):
        raise GatewaySSRFError(f"Invalid scheme '{parsed.scheme}'. Only http and https are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise GatewaySSRFError("URL must contain a valid hostname.")

    hostname_lower = hostname.lower()

    # 1. Allowlist bypass for known cluster-internal service hostnames
    if hostname_lower in [h.lower() for h in settings.ssrf_allowed_hosts]:
        return url

    # Disallow literal localhost
    if hostname_lower in ("localhost", "localhost.localdomain", "broadcasthost"):
        raise GatewaySSRFError(f"Connecting to localhost ({hostname}) is forbidden.")

    # DNS check
    try:
        addr_info = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise GatewaySSRFError(f"Could not resolve hostname '{hostname}': {exc}") from exc

    resolved_ips = {item[4][0] for item in addr_info}
    for ip_str in resolved_ips:
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError as exc:
            raise GatewaySSRFError(f"Invalid resolved IP '{ip_str}'") from exc

        if ip.is_loopback:
            raise GatewaySSRFError(f"Loopback IP forbidden: {ip_str}")
        if ip.is_private:
            raise GatewaySSRFError(f"Private network IP forbidden: {ip_str}")
        if ip.is_link_local or ip_str == "169.254.169.254":
            raise GatewaySSRFError(f"Metadata/link-local IP forbidden: {ip_str}")
        if ip.is_multicast or ip.is_unspecified:
            raise GatewaySSRFError(f"Special IP forbidden: {ip_str}")

    return url
