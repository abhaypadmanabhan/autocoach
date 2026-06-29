"""Event-loop unblocking regression tests (#18 — Scale).

Backstory: the session route handlers were `async def` but called blocking
sync I/O (Supabase, Qdrant, the LLM) inline, freezing the single event loop.
The fix:
  * route handlers are now plain `def` → Starlette runs them in a threadpool,
    keeping blocking work OFF the loop;
  * the `get_user_id_from_token` auth dependency (still `async`) offloads its
    blocking `supabase_admin.auth.get_user` call via `run_in_threadpool`.

These tests guard that the loop is no longer frozen and provide the
before/after concurrency evidence the brief asks for.
"""

import asyncio
import inspect
import time
from unittest.mock import MagicMock, patch
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI

from app.api.routes import documents, quiz, sessions
from app.main import app


USER_ID = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
SESSION_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff"


# ---------------------------------------------------------------------------
# 1. Regression guard: handlers must stay sync so Starlette threadpools them.
# ---------------------------------------------------------------------------


def test_session_route_handlers_are_sync():
    """A plain `def` handler is run in the threadpool; an `async def` handler
    runs on the event loop. Every session handler calls blocking session_manager
    I/O, so they MUST be sync. If someone re-adds `async`, the loop re-freezes —
    fail loudly here."""
    for fn in (
        sessions.create_quiz_session,
        sessions.get_session_status,
        sessions.get_current_quiz_question,
        sessions.submit_quiz_answer,
        sessions.get_next_question,
        quiz.generate_quiz,
    ):
        assert not inspect.iscoroutinefunction(fn), (
            f"{fn.__name__} must be a plain `def` handler so Starlette runs it "
            f"in a threadpool (it calls blocking sync I/O); found `async def`."
        )


def test_auth_dependency_stays_async():
    """The auth dependency must remain `async` because it awaits
    run_in_threadpool to offload the blocking token check."""
    assert inspect.iscoroutinefunction(documents.get_user_id_from_token)


# ---------------------------------------------------------------------------
# 2. Auth dependency offloads the blocking get_user call (not run on the loop).
# ---------------------------------------------------------------------------


def test_auth_dependency_offloads_blocking_get_user():
    """`get_user_id_from_token` must route the blocking
    `supabase_admin.auth.get_user` through run_in_threadpool, not call it
    inline on the loop."""
    offloaded: list = []

    async def spy_run_in_threadpool(func, *args, **kwargs):
        offloaded.append((func, args, kwargs))
        return func(*args, **kwargs)

    fake_supa = MagicMock()
    fake_supa.auth.get_user.return_value = MagicMock(user=MagicMock(id=str(USER_ID)))

    with patch.object(documents, "run_in_threadpool", spy_run_in_threadpool), \
         patch.object(documents, "supabase_admin", fake_supa):
        result = asyncio.run(documents.get_user_id_from_token("Bearer tok-123"))

    assert result == USER_ID
    assert offloaded, "auth check must be offloaded via run_in_threadpool"
    func, args, _ = offloaded[0]
    assert func is fake_supa.auth.get_user
    assert args == ("tok-123",)


# ---------------------------------------------------------------------------
# 3. Mechanism before/after: blocking work in an async handler serializes and
#    starves a fast endpoint; the same work in a sync (threadpooled) handler
#    runs in parallel and leaves the fast endpoint responsive.
# ---------------------------------------------------------------------------


def _build_probe_app(slow_seconds: float) -> FastAPI:
    """Tiny app with an async-blocking and a sync-blocking version of the same
    blocking work, plus a fast async /ping (stand-in for /health)."""
    probe = FastAPI()

    @probe.get("/slow-async")
    async def slow_async():  # blocks the event loop
        time.sleep(slow_seconds)
        return {"ok": True}

    @probe.get("/slow-sync")
    def slow_sync():  # threadpooled by Starlette → loop stays free
        time.sleep(slow_seconds)
        return {"ok": True}

    @probe.get("/ping")
    async def ping():
        return {"pong": True}

    return probe


async def _run_concurrency_probe(target_path: str, slow_seconds: float, n: int):
    """Fire n concurrent slow requests; mid-flight, hit a fast /ping. Returns
    (total_seconds, ping_offset_seconds, ping_status), where ping_offset is the
    time from probe start until /ping *completes* — a frozen loop pushes that
    late (the ping can't be served while a blocking handler owns the loop),
    while a free loop serves it almost immediately."""
    probe = _build_probe_app(slow_seconds)
    transport = httpx.ASGITransport(app=probe)
    t0 = 0.0
    async with httpx.AsyncClient(transport=transport, base_url="http://probe") as client:

        async def ping_timing():
            await asyncio.sleep(slow_seconds * 0.25)  # let slow reqs get in-flight
            r = await client.get("/ping")
            return time.perf_counter() - t0, r.status_code

        t0 = time.perf_counter()
        slow_tasks = [client.get(target_path) for _ in range(n)]
        *slow_results, ping_result = await asyncio.gather(*slow_tasks, ping_timing())
        total = time.perf_counter() - t0

    assert all(r.status_code == 200 for r in slow_results)
    ping_offset, ping_status = ping_result
    return total, ping_offset, ping_status


def test_async_handler_serializes_and_starves_loop():
    """BEFORE picture: an async handler doing blocking work serializes the
    requests and the loop cannot serve /ping until it frees."""
    slow, n = 0.2, 4
    total, ping_offset, ping_status = asyncio.run(
        _run_concurrency_probe("/slow-async", slow, n)
    )
    assert ping_status == 200
    # Serialized: total is near the SUM of the blocking calls.
    assert total >= slow * n * 0.7, (
        f"expected async handler to serialize (~{slow*n:.2f}s), got {total:.2f}s"
    )
    # Loop starved: /ping cannot complete until a blocking handler frees the
    # loop, so it lands at least one blocking unit after probe start.
    assert ping_offset >= slow * 0.7, (
        f"expected /ping to be starved (>={slow*0.7:.3f}s), got {ping_offset:.3f}s"
    )


def test_sync_handler_keeps_loop_free():
    """AFTER picture: a sync (threadpooled) handler runs the same blocking work
    in parallel and the loop serves /ping immediately."""
    slow, n = 0.2, 4
    total, ping_offset, ping_status = asyncio.run(
        _run_concurrency_probe("/slow-sync", slow, n)
    )
    assert ping_status == 200
    # Parallel: total is near a SINGLE blocking call, not the sum.
    assert total < slow * n * 0.6, (
        f"expected sync handler to parallelize (<{slow*n*0.6:.2f}s), got {total:.2f}s"
    )
    # Loop free: /ping completes early, well within one blocking unit.
    assert ping_offset < slow * 0.7, (
        f"expected /ping to stay fast (<{slow*0.7:.3f}s), got {ping_offset:.3f}s"
    )


# ---------------------------------------------------------------------------
# 4. Real app: the actual /quiz/sessions/{id}/next handler runs off the loop —
#    concurrent long-polls parallelize and /health stays responsive.
# ---------------------------------------------------------------------------


async def _probe_real_next(slow_seconds: float, n: int):
    transport = httpx.ASGITransport(app=app)
    t0 = 0.0
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:

        async def health_timing():
            await asyncio.sleep(slow_seconds * 0.25)
            r = await client.get("/health")
            return time.perf_counter() - t0, r.status_code

        t0 = time.perf_counter()
        next_tasks = [
            client.get(f"/quiz/sessions/{SESSION_ID}/next") for _ in range(n)
        ]
        *next_results, health_result = await asyncio.gather(
            *next_tasks, health_timing()
        )
        total = time.perf_counter() - t0

    return next_results, total, health_result


def test_real_next_handler_runs_off_loop():
    """The real /next handler (now plain `def`) must threadpool its blocking
    long-poll so concurrent polls run in parallel and /health is not starved."""
    slow, n = 0.2, 4

    def slow_wait(session_id, user_id, wait_ms):
        time.sleep(slow)
        return {"status": "preparing", "retry_after_ms": 500}

    # Bypass auth + rate limit; the route's only real work is wait_for_next_question.
    app.dependency_overrides[sessions.enforce_quiz_rate_limit] = lambda: USER_ID
    try:
        with patch.object(sessions, "wait_for_next_question", slow_wait):
            next_results, total, (health_offset, health_status) = asyncio.run(
                _probe_real_next(slow, n)
            )
    finally:
        app.dependency_overrides.pop(sessions.enforce_quiz_rate_limit, None)

    assert all(r.status_code == 200 for r in next_results)
    assert all(r.json()["status"] == "preparing" for r in next_results)
    assert health_status == 200
    # Concurrent long-polls parallelize (off the loop), not serialize.
    assert total < slow * n * 0.6, (
        f"expected /next polls to parallelize (<{slow*n*0.6:.2f}s), got {total:.2f}s"
    )
    # /health completes early while polls are in flight (loop not frozen).
    assert health_offset < slow * 0.7, (
        f"expected /health to stay fast (<{slow*0.7:.3f}s), got {health_offset:.3f}s"
    )
