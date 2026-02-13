from unittest.mock import MagicMock
from uuid import uuid4

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
)

from app.main import app
from app.api.routes import documents
from app.api.routes.documents import get_user_id_from_token

client = TestClient(app)

user_id = str(uuid4())


async def override_get_user_id_from_token():
    return user_id


app.dependency_overrides[get_user_id_from_token] = override_get_user_id_from_token


def test_get_document_summary_404_when_document_missing(mocker):
    mock_supabase = MagicMock()
    mocker.patch.object(documents, "supabase_admin", mock_supabase)

    docs_table = MagicMock()
    docs_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    mock_supabase.table.side_effect = lambda name: docs_table

    response = client.get(f"/documents/{uuid4()}/summary")
    assert response.status_code == 404


def test_get_document_summary_409_when_concepts_not_ready(mocker):
    mock_supabase = MagicMock()
    mocker.patch.object(documents, "supabase_admin", mock_supabase)

    doc_id = str(uuid4())

    docs_execute = MagicMock()
    docs_execute.data = [
        {"id": doc_id, "summary_json": None, "summary_concepts_hash": None}
    ]
    concepts_execute = MagicMock()
    concepts_execute.data = []

    docs_table = MagicMock()
    docs_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = docs_execute
    concepts_table = MagicMock()
    concepts_table.select.return_value.eq.return_value.execute.return_value = (
        concepts_execute
    )

    mock_supabase.table.side_effect = (
        lambda name: docs_table if name == "documents" else concepts_table
    )

    response = client.get(f"/documents/{doc_id}/summary")
    assert response.status_code == 409


def test_get_document_summary_returns_existing_when_hash_matches(mocker):
    mock_supabase = MagicMock()
    mocker.patch.object(documents, "supabase_admin", mock_supabase)

    doc_id = str(uuid4())
    stored_summary = {
        "one_liner": "Intro to core topics.",
        "what_youll_learn": ["Learn basics"],
        "key_concepts": ["Topic A"],
        "study_plan": ["Practice daily"],
    }

    docs_execute = MagicMock()
    docs_execute.data = [
        {
            "id": doc_id,
            "summary_json": stored_summary,
            "summary_generated_at": "2026-02-12T00:00:00+00:00",
            "summary_version": "v1",
            "summary_concepts_hash": "hash123",
        }
    ]
    concepts_execute = MagicMock()
    concepts_execute.data = [
        {
            "concept_name": "Topic A",
            "concept_description": "Desc",
            "importance_score": 0.9,
        }
    ]

    docs_table = MagicMock()
    docs_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = docs_execute
    concepts_table = MagicMock()
    concepts_table.select.return_value.eq.return_value.execute.return_value = (
        concepts_execute
    )

    generate_mock = mocker.patch(
        "app.api.routes.documents.generate_document_summary",
        return_value=stored_summary,
    )
    mocker.patch(
        "app.api.routes.documents.compute_concepts_hash", return_value="hash123"
    )

    mock_supabase.table.side_effect = (
        lambda name: docs_table if name == "documents" else concepts_table
    )

    response = client.get(f"/documents/{doc_id}/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["summary"] == stored_summary
    generate_mock.assert_not_called()


def test_get_document_summary_regenerates_when_hash_mismatch(mocker):
    mock_supabase = MagicMock()
    mocker.patch.object(documents, "supabase_admin", mock_supabase)

    doc_id = str(uuid4())
    generated_summary = {
        "one_liner": "Generated summary.",
        "what_youll_learn": ["Learn Topic A"],
        "key_concepts": ["Topic A"],
        "study_plan": ["Take a quiz"],
    }

    docs_execute = MagicMock()
    docs_execute.data = [
        {
            "id": doc_id,
            "summary_json": {
                "one_liner": "stale",
                "what_youll_learn": ["x"],
                "key_concepts": ["x"],
                "study_plan": ["x"],
            },
            "summary_concepts_hash": "old_hash",
        }
    ]
    concepts_execute = MagicMock()
    concepts_execute.data = [
        {
            "concept_name": "Topic A",
            "concept_description": "Desc",
            "importance_score": 0.9,
        }
    ]
    refreshed_execute = MagicMock()
    refreshed_execute.data = {
        "summary_generated_at": "2026-02-12T01:00:00+00:00",
        "summary_version": "v1",
    }

    docs_table = MagicMock()
    docs_select = docs_table.select.return_value
    docs_eq1 = docs_select.eq.return_value
    docs_eq2 = docs_eq1.eq.return_value
    docs_eq2.execute.return_value = docs_execute
    docs_select_single = docs_select.eq.return_value.single.return_value
    docs_select_single.execute.return_value = refreshed_execute

    concepts_table = MagicMock()
    concepts_table.select.return_value.eq.return_value.execute.return_value = (
        concepts_execute
    )

    generate_mock = mocker.patch(
        "app.api.routes.documents.generate_document_summary",
        return_value=generated_summary,
    )
    mocker.patch(
        "app.api.routes.documents.compute_concepts_hash", return_value="new_hash"
    )

    def table_side_effect(name):
        if name == "documents":
            return docs_table
        if name == "concepts":
            return concepts_table
        raise AssertionError(f"Unexpected table: {name}")

    mock_supabase.table.side_effect = table_side_effect

    response = client.get(f"/documents/{doc_id}/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["summary"] == generated_summary
    generate_mock.assert_called_once()
