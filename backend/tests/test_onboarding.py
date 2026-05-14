"""Tests for /onboarding GET + POST routes.

Uses TestClient + mocked supabase_admin (matches test_health.py pattern).
Original test referenced an `async_client` fixture that was never committed
and a SQLAlchemy `AsyncSession` model that does not match the real route
(which uses the Supabase REST client). Rewritten as Supabase-mocked tests.
"""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

import app.config

app.config.get_settings = lambda: MagicMock(
    supabase_url="http://test",
    supabase_publishable_key="test",
    supabase_secret_key="test",
    qdrant_url="http://test",
    qdrant_api_key="test",
    kimi_api_key="test",
    max_document_mb=10,
    max_documents_per_user=10,
    max_quiz_sessions_per_day=5,
    quiz_requests_per_minute=60,
    environment="test",
)

from app.main import app
from app.api.routes.documents import get_user_id_from_token
from app.api.routes import onboarding as onboarding_route


user_id = str(uuid4())


async def override_get_user_id_from_token():
    return user_id


app.dependency_overrides[get_user_id_from_token] = override_get_user_id_from_token


@pytest.fixture
def client():
    return TestClient(app)


def _select_chain(return_rows: list) -> MagicMock:
    """Build a mock that satisfies table().select().eq().limit().execute()."""
    chain = MagicMock()
    chain.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=return_rows
    )
    return chain


def test_get_onboarding_returns_not_completed_when_no_row(client, mocker):
    mock_supa = _select_chain([])
    mocker.patch.object(onboarding_route, "supabase_admin", mock_supa)

    response = client.get("/onboarding")

    assert response.status_code == 200
    body = response.json()
    assert body["has_completed"] is False
    assert body["learning_topics"] is None


def test_get_onboarding_returns_completed_when_row_exists(client, mocker):
    mock_supa = _select_chain(
        [
            {
                "learning_topics": {"topic1": True, "topic2": False},
                "goal": "Pass my exams",
                "study_frequency": "Every day",
                "experience_level": "intermediate",
            }
        ]
    )
    mocker.patch.object(onboarding_route, "supabase_admin", mock_supa)

    response = client.get("/onboarding")

    assert response.status_code == 200
    body = response.json()
    assert body["has_completed"] is True
    assert body["goal"] == "Pass my exams"
    assert body["study_frequency"] == "Every day"
    assert body["learning_topics"] == {"topic1": True, "topic2": False}
    assert body["experience_level"] == "intermediate"


def test_post_onboarding_upserts_and_returns_payload(client, mocker):
    mock_supa = MagicMock()
    # Existing-row lookup returns no prior data
    mock_supa.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[]
    )
    # Upsert returns truthy result
    mock_supa.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[{"user_id": user_id}]
    )
    mocker.patch.object(onboarding_route, "supabase_admin", mock_supa)

    payload = {
        "learning_topics": {"topic1": True, "topic2": False},
        "goal": "Pass my exams",
        "study_frequency": "Every day",
        "experience_level": "intermediate",
    }
    response = client.post("/onboarding", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["has_completed"] is True
    assert body["goal"] == "Pass my exams"
    assert body["study_frequency"] == "Every day"
    assert body["experience_level"] == "intermediate"
    # learning_topics is merged with experience_level injected by the route
    assert body["learning_topics"]["topic1"] is True
    assert body["learning_topics"]["topic2"] is False
    assert body["learning_topics"]["experience_level"] == "intermediate"


def test_post_onboarding_partial_update_merges_existing(client, mocker):
    mock_supa = MagicMock()
    # Existing-row lookup returns prior onboarding data
    mock_supa.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[
            {
                "learning_topics": {"topic1": True, "experience_level": "intermediate"},
                "goal": "Pass my exams",
                "study_frequency": "Every day",
                "experience_level": "intermediate",
            }
        ]
    )
    mock_supa.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[{"user_id": user_id}]
    )
    mocker.patch.object(onboarding_route, "supabase_admin", mock_supa)

    response = client.post("/onboarding", json={"study_frequency": "Once a week"})

    assert response.status_code == 200
    body = response.json()
    assert body["has_completed"] is True
    assert body["goal"] == "Pass my exams"  # preserved
    assert body["study_frequency"] == "Once a week"  # updated
    assert body["experience_level"] == "intermediate"  # preserved
