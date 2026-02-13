from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from uuid import uuid4
from app.services import concepts as concepts_service

# Mock settings
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
)

from app.main import app

client = TestClient(app)

# Mock auth dependency
from app.api.routes.documents import get_user_id_from_token

user_id = str(uuid4())


async def override_get_user_id_from_token():
    return user_id


app.dependency_overrides[get_user_id_from_token] = override_get_user_id_from_token


def test_get_review_today(mocker):
    # Mock the service function NOT the supabase calls, to keep unit test focused on endpoint/contract
    # We can also add a test for the service logic if we want, but endpoint test is priority as per plan.

    mock_concepts = [
        {
            "id": str(uuid4()),
            "name": "Concept 1",
            "document_id": str(uuid4()),
            "mastery_score": 40.0,
            "mastery_percent": 40,
            "last_tested_at": "2023-01-01T00:00:00Z",
        },
        {
            "id": str(uuid4()),
            "name": "Concept 2",
            "document_id": str(uuid4()),
            "mastery_score": 80.0,  # This shouldn't happen based on service logic, but endpoint just forwards
            "mastery_percent": 80,
            "last_tested_at": "2023-01-01T00:00:00Z",
        },
    ]

    mocker.patch("app.api.routes.review.get_due_concepts", return_value=mock_concepts)

    response = client.get("/review/today?limit=10")

    assert response.status_code == 200
    data = response.json()

    assert data["count"] == 2
    assert len(data["due_concepts"]) == 2
    assert data["due_concepts"][0]["name"] == "Concept 1"
    assert data["due_concepts"][0]["mastery_score"] == 40.0
    assert data["rules"]["mastery_below"] == 0.75
    assert data["rules"]["stale_days"] == 2


def test_get_review_today_empty(mocker):
    mocker.patch("app.api.routes.review.get_due_concepts", return_value=[])

    response = client.get("/review/today")

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0
    assert data["due_concepts"] == []


def test_get_review_today_limit_validation():
    response = client.get("/review/today?limit=21")
    assert response.status_code == 422


class _FakeResponse:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, table_name, state):
        self.table_name = table_name
        self.state = state
        self._or_filter = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def or_(self, clause):
        self._or_filter = clause
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, value):
        self.state["last_limit"] = value
        return self

    def lt(self, *_args, **_kwargs):
        return self

    def in_(self, *_args, **_kwargs):
        return self

    def execute(self):
        if self.table_name == "user_concept_mastery":
            if (
                self._or_filter is not None
                and "last_practiced_at" in self._or_filter
                and self.state["raise_last_practiced_once"]
            ):
                self.state["raise_last_practiced_once"] = False
                raise Exception(
                    "column user_concept_mastery.last_practiced_at does not exist"
                )
            return _FakeResponse(self.state["mastery_rows"])

        if self.table_name == "concepts":
            return _FakeResponse(self.state["concept_rows"])

        return _FakeResponse([])


class _FakeSupabase:
    def __init__(self, state):
        self.state = state

    def table(self, table_name):
        return _FakeQuery(table_name, self.state)


def test_get_due_concepts_fallback_and_ordering(monkeypatch):
    concept_a = str(uuid4())
    concept_b = str(uuid4())
    concept_c = str(uuid4())
    state = {
        "raise_last_practiced_once": True,
        "last_limit": None,
        "mastery_rows": [
            {
                "concept_id": concept_a,
                "mastery_score": 40,
                "last_tested_at": None,
                "times_tested": 2,
            },
            {
                "concept_id": concept_b,
                "mastery_score": 40,
                "last_tested_at": "2024-01-01T00:00:00+00:00",
                "times_tested": 2,
            },
            {
                "concept_id": concept_c,
                "mastery_score": 50,
                "last_tested_at": "2024-01-02T00:00:00+00:00",
                "times_tested": 2,
            },
        ],
        "concept_rows": [
            {"id": concept_a, "concept_name": "A", "document_id": str(uuid4())},
            {"id": concept_b, "concept_name": "B", "document_id": str(uuid4())},
            {"id": concept_c, "concept_name": "C", "document_id": str(uuid4())},
        ],
    }

    monkeypatch.setattr(concepts_service, "supabase_admin", _FakeSupabase(state))

    result = concepts_service.get_due_concepts(user_id=str(uuid4()), limit=100)

    assert len(result) == 3
    assert state["last_limit"] == 20
    assert [item["name"] for item in result] == ["B", "A", "C"]
