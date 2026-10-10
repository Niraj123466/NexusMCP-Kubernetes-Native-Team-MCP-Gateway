"""Unit tests for Time MCP tools."""
import pytest
from time_mcp.tools import get_current_time, list_timezones


def test_get_current_time_utc():
    res = get_current_time("UTC")
    assert res["timezone"] == "UTC"
    assert "iso" in res
    assert "date" in res
    assert "time" in res
    assert res["utc_offset"] in ("UTC", "UTC+00:00")
    assert isinstance(res["timestamp"], int)


def test_get_current_time_named_zones():
    for tz in ["America/New_York", "Asia/Tokyo", "Europe/London"]:
        res = get_current_time(tz)
        assert res["timezone"] == tz
        assert "iso" in res
        assert "date" in res


def test_get_current_time_invalid():
    with pytest.raises(ValueError) as exc:
        get_current_time("Mars/Phobos")
    assert "Invalid timezone" in str(exc.value)


def test_list_timezones_unfiltered():
    all_tzs = list_timezones()
    assert len(all_tzs) > 100
    assert "UTC" in all_tzs
    assert "America/New_York" in all_tzs


def test_list_timezones_search():
    tokyo = list_timezones(search="Tokyo")
    assert "Asia/Tokyo" in tokyo

    york = list_timezones(search="York")
    assert "America/New_York" in york
