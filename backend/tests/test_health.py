"""Tests for /health and /health?deep=true."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_shallow_always_200(client):
    """Default /health is shallow — must stay 200 even if a dep is down."""
    with patch("app.api.routes.health.qdrant_client.get_collections", side_effect=RuntimeError("down")):
        r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "healthy", "service": "autocoach-api"}


def test_health_deep_all_ok(client):
    with patch("app.api.routes.health.qdrant_client.get_collections", return_value=object()), \
         patch("app.api.routes.health.supabase_admin") as mock_supa:
        # Chain table().select().limit().execute() to a no-op return.
        mock_supa.table.return_value.select.return_value.limit.return_value.execute.return_value = None
        r = client.get("/health?deep=true")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["checks"]["qdrant"]["status"] == "ok"
    assert body["checks"]["postgres"]["status"] == "ok"
    assert isinstance(body["checks"]["qdrant"]["latency_ms"], (int, float))
    assert isinstance(body["checks"]["postgres"]["latency_ms"], (int, float))


def test_health_deep_qdrant_down_returns_503(client):
    with patch("app.api.routes.health.qdrant_client.get_collections", side_effect=RuntimeError("qdrant unreachable")), \
         patch("app.api.routes.health.supabase_admin") as mock_supa:
        mock_supa.table.return_value.select.return_value.limit.return_value.execute.return_value = None
        r = client.get("/health?deep=true")
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "degraded"
    assert body["checks"]["qdrant"]["status"].startswith("error: RuntimeError")
    assert body["checks"]["postgres"]["status"] == "ok"


def test_health_deep_postgres_down_returns_503(client):
    with patch("app.api.routes.health.qdrant_client.get_collections", return_value=object()), \
         patch("app.api.routes.health.supabase_admin") as mock_supa:
        mock_supa.table.return_value.select.return_value.limit.return_value.execute.side_effect = ConnectionError("pg down")
        r = client.get("/health?deep=true")
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "degraded"
    assert body["checks"]["qdrant"]["status"] == "ok"
    assert body["checks"]["postgres"]["status"].startswith("error: ConnectionError")
