"""Time tools implementation using Python standard library zoneinfo."""
from __future__ import annotations

from datetime import datetime
from typing import Any
import zoneinfo
import structlog

log = structlog.get_logger(__name__)


def get_current_time(timezone: str = "UTC") -> dict[str, Any]:
    """
    Get the current date, time, and timezone information.

    Args:
        timezone: An IANA timezone identifier (e.g. 'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo').
                  Defaults to 'UTC'.

    Returns:
        A dictionary with ISO datetime, human-readable format, UTC offset, and timezone details.
    """
    try:
        tz = zoneinfo.ZoneInfo(timezone)
    except Exception as exc:
        log.warning("invalid_timezone_requested", timezone=timezone)
        raise ValueError(
            f"Invalid timezone: '{timezone}'. Use list_timezones to find valid IANA timezone names."
        ) from exc

    now = datetime.now(tz)
    offset = now.strftime("%z")
    formatted_offset = f"UTC{offset[:3]}:{offset[3:]}" if offset else "UTC"

    return {
        "timezone": timezone,
        "iso": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "day_of_week": now.strftime("%A"),
        "utc_offset": formatted_offset,
        "is_dst": bool(now.dst()),
        "timestamp": int(now.timestamp()),
    }


def list_timezones(search: str | None = None) -> list[str]:
    """
    List available IANA timezones, optionally filtered by keyword.

    Args:
        search: Optional case-insensitive substring to filter timezones (e.g. 'York', 'London', 'Asia', 'Pacific').

    Returns:
        A sorted list of matching IANA timezone names.
    """
    all_timezones = sorted(zoneinfo.available_timezones())
    if not search:
        return all_timezones

    search_lower = search.strip().lower()
    return [tz for tz in all_timezones if search_lower in tz.lower()]
