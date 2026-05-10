"""Tests for the Qdrant keep-alive background loop."""

import asyncio
from unittest.mock import patch

import pytest

from app.core import qdrant as qdrant_module


@pytest.mark.asyncio
async def test_keepalive_disabled_when_interval_zero(caplog):
    caplog.set_level("INFO")
    # Should return immediately without calling get_collections.
    with patch.object(qdrant_module.qdrant_client, "get_collections") as mock_get:
        await qdrant_module.keepalive_loop(0)
    assert mock_get.call_count == 0
    assert any("Qdrant keep-alive disabled" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_keepalive_pings_then_cancels():
    """The loop pings on each interval; cancellation is honored cleanly.

    We don't mock asyncio.sleep (global patch is hazardous) — instead we run
    with a short real interval and let the loop tick a few times before cancel.
    """
    with patch.object(qdrant_module.qdrant_client, "get_collections") as mock_get:
        task = asyncio.create_task(qdrant_module.keepalive_loop(0.01))
        await asyncio.sleep(0.06)  # ~5 ticks at 10ms each
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    assert mock_get.call_count >= 2, f"expected ≥2 pings, got {mock_get.call_count}"


@pytest.mark.asyncio
async def test_keepalive_swallows_exceptions():
    """A failed ping must not kill the loop."""
    with patch.object(
        qdrant_module.qdrant_client, "get_collections", side_effect=RuntimeError("boom")
    ) as mock_get:
        task = asyncio.create_task(qdrant_module.keepalive_loop(0.01))
        await asyncio.sleep(0.06)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    assert mock_get.call_count >= 2, f"loop should keep going across failures; got {mock_get.call_count}"
