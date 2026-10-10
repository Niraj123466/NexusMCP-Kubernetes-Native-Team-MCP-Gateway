"""SSRF Guard utility to validate destination URLs against forbidden IPs and metadata endpoints."""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse
import structlog

from fetch_mcp.config import settings

log = structlog.get_logger(__name__)


class SSRFValidationError(ValueError):
    """Raised when an outbound URL violates SSRF security boundaries."""


def validate_url(url: str) -> str:
    """
    Validate that a given URL is safe to fetch:
    1. Scheme must be http or https
    2. Hostname must resolve to a valid public IP (not private, loopback, or metadata)
    3. Hostname must match allowed_domains if configured

    Returns:
        The validated URL.

    Raises:
        SSRFValidationError: If the URL fails security checks.
    """
    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https"):
        raise SSRFValidationError(f"Invalid URL scheme '{parsed.scheme}'. Only http and https are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFValidationError("URL must include a valid hostname.")

    hostname_lower = hostname.lower()

    # Domain allowlist check
    if settings.domain_allowlist:
        allowed = any(
            hostname_lower == domain or hostname_lower.endswith(f".{domain}")
            for domain in settings.domain_allowlist
        )
        if not allowed:
            raise SSRFValidationError(
                f"Domain '{hostname}' is not in the allowed domains list: {settings.domain_allowlist}"
            )

    # Disallow literal localhost / common aliases
    if hostname_lower in ("localhost", "localhost.localdomain", "broadcasthost"):
        raise SSRFValidationError(f"Access to localhost ({hostname}) is forbidden.")

    # DNS Resolution and IP checks
    try:
        # Resolve all addresses
        addr_info = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise SSRFValidationError(f"Could not resolve hostname '{hostname}': {exc}") from exc

    resolved_ips = {item[4][0] for item in addr_info}
    for ip_str in resolved_ips:
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError as exc:
            raise SSRFValidationError(f"Invalid resolved IP '{ip_str}'") from exc

        # Check for loopback, private, link-local, multicast, unspecified
        if ip.is_loopback:
            raise SSRFValidationError(f"Loopback IP access forbidden: {ip_str}")
        if ip.is_private:
            raise SSRFValidationError(f"Private network IP access forbidden: {ip_str}")
        if ip.is_link_local:
            raise SSRFValidationError(f"Link-local IP access forbidden: {ip_str}")
        if ip.is_multicast:
            raise SSRFValidationError(f"Multicast IP access forbidden: {ip_str}")
        if ip.is_unspecified:
            raise SSRFValidationError(f"Unspecified IP access forbidden: {ip_str}")
        # Cloud metadata service guard (169.254.169.254)
        if ip_str == "169.254.169.254":
            raise SSRFValidationError("Cloud metadata service access forbidden.")

    return url
