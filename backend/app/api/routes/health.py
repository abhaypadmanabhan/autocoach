"""Health endpoints — shallow (always 200) and deep (probes Qdrant + Postgres)."""

import logging
import time

from fastapi import APIRouter, Query, Response, status

from app.core.qdrant import qdrant_client
from app.core.supabase import supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()

DEEP_PROBE_TIMEOUT_S = 5.0


def _probe_qdrant() -> tuple[str, float]:
    """Return (status_str, latency_ms). status_str is 'ok' or 'error: ...'."""
    t0 = time.perf_counter()
    try:
        qdrant_client.get_collections()
        return "ok", (time.perf_counter() - t0) * 1000.0
    except Exception as e:
        latency = (time.perf_counter() - t0) * 1000.0
        logger.warning("Qdrant deep-health probe failed: %s", e)
        return f"error: {type(e).__name__}: {e}"[:200], latency


def _probe_postgres() -> tuple[str, float]:
    """Cheap COUNT against the documents table — verifies Supabase auth + DB reachability."""
    t0 = time.perf_counter()
    try:
        supabase_admin.table("documents").select("id", count="exact").limit(0).execute()
        return "ok", (time.perf_counter() - t0) * 1000.0
    except Exception as e:
        latency = (time.perf_counter() - t0) * 1000.0
        logger.warning("Postgres deep-health probe failed: %s", e)
        return f"error: {type(e).__name__}: {e}"[:200], latency


@router.get("/health")
async def health_check(
    response: Response,
    deep: bool = Query(False, description="Probe Qdrant + Postgres connectivity"),
):
    """Health endpoint.

    Default (`/health`): shallow — always 200 with a static body. Used by
    Railway / load-balancer healthchecks where flapping on a downstream
    failure is undesirable.

    Deep (`/health?deep=true`): probes Qdrant + Postgres. Returns 503 if any
    check fails, with a `checks` map showing per-dep status and latency.
    """
    if not deep:
        return {"status": "healthy", "service": "autocoach-api"}

    qdrant_status, qdrant_ms = _probe_qdrant()
    pg_status, pg_ms = _probe_postgres()

    all_ok = qdrant_status == "ok" and pg_status == "ok"
    if not all_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if all_ok else "degraded",
        "service": "autocoach-api",
        "checks": {
            "qdrant": {"status": qdrant_status, "latency_ms": round(qdrant_ms, 1)},
            "postgres": {"status": pg_status, "latency_ms": round(pg_ms, 1)},
        },
    }
