"""Tool namespacing helpers to avoid collisions across multiple upstream MCP servers."""
from __future__ import annotations

DELIMITER = "__"


def namespace_tool(upstream_slug: str, original_tool_name: str) -> str:
    """Format: <upstream_slug>__<original_tool_name>"""
    return f"{upstream_slug}{DELIMITER}{original_tool_name}"


def parse_namespaced_tool(namespaced_name: str) -> tuple[str, str]:
    """
    Split namespaced tool name into (upstream_slug, original_tool_name).
    If no delimiter exists, returns ('', namespaced_name).
    """
    if DELIMITER in namespaced_name:
        parts = namespaced_name.split(DELIMITER, 1)
        return parts[0], parts[1]
    return "", namespaced_name
