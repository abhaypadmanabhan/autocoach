import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from uuid import uuid4

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

# Import app and modules to patch
from app.main import app
from app.api.routes import documents

client = TestClient(app)

# Mock auth dependency
from app.api.routes.documents import get_user_id_from_token

user_id = str(uuid4())


async def override_get_user_id_from_token():
    return user_id


app.dependency_overrides[get_user_id_from_token] = override_get_user_id_from_token


def test_get_document_progress(mocker):
    # Mock supabase_admin in the routes module
    mock_supabase = MagicMock()
    mocker.patch.object(documents, "supabase_admin", mock_supabase)

    doc_id = str(uuid4())

    # Mock DB response for document fetch
    mock_execute = MagicMock()
    mock_execute.data = [
        {
            "id": doc_id,
            "user_id": user_id,
            "filename": "test.pdf",
            "ai_title": "Test Doc",
            "status": "ready",
        }
    ]

    # Configure chain: table().select().eq().eq().execute()
    mock_select = mock_supabase.table.return_value.select.return_value
    mock_eq1 = mock_select.eq.return_value
    mock_eq2 = mock_eq1.eq.return_value
    mock_eq2.execute.return_value = mock_execute

    # Mock get_document_concepts
    mock_concepts = [
        {"id": str(uuid4()), "concept_name": "C1", "mastery_score": 0.8},
        {"id": str(uuid4()), "concept_name": "C2", "mastery_score": 0.4},
        {"id": str(uuid4()), "concept_name": "C3", "mastery_score": 0.0},
    ]
    mocker.patch(
        "app.api.routes.documents.get_document_concepts", return_value=mock_concepts
    )

    response = client.get(f"/documents/{doc_id}/progress")

    assert response.status_code == 200
    data = response.json()
    assert data["mastery_percent"] == 40
    assert data["milestone"] == "25"


def test_get_document_progress_handles_percent_scale(mocker):
    mock_supabase = MagicMock()
    mocker.patch.object(documents, "supabase_admin", mock_supabase)

    doc_id = str(uuid4())

    mock_execute = MagicMock()
    mock_execute.data = [
        {
            "id": doc_id,
            "user_id": user_id,
            "filename": "test.pdf",
            "ai_title": "Test Doc",
            "status": "ready",
        }
    ]

    mock_select = mock_supabase.table.return_value.select.return_value
    mock_eq1 = mock_select.eq.return_value
    mock_eq2 = mock_eq1.eq.return_value
    mock_eq2.execute.return_value = mock_execute

    # Stored as 0..100 values from session_manager updates
    mock_concepts = [
        {
            "id": str(uuid4()),
            "concept_name": "C1",
            "mastery_score": 80,
            "times_tested": 1,
        },
        {
            "id": str(uuid4()),
            "concept_name": "C2",
            "mastery_score": 40,
            "times_tested": 1,
        },
        {
            "id": str(uuid4()),
            "concept_name": "C3",
            "mastery_score": 0,
            "times_tested": 0,
        },
    ]
    mocker.patch(
        "app.api.routes.documents.get_document_concepts", return_value=mock_concepts
    )

    response = client.get(f"/documents/{doc_id}/progress")

    assert response.status_code == 200
    data = response.json()
    assert data["mastery_percent"] == 40
    assert data["milestone"] == "25"


def test_get_document_progress_summary(mocker):
    mock_supabase = MagicMock()
    mocker.patch.object(documents, "supabase_admin", mock_supabase)

    d1_id = str(uuid4())
    d2_id = str(uuid4())

    # Mock list of documents
    docs_execute = MagicMock()
    docs_execute.data = [
        {"id": d1_id, "filename": "d1.pdf", "ai_title": "Doc 1"},
        {"id": d2_id, "filename": "d2.pdf", "ai_title": None},
    ]

    # Mock concepts for both docs in a single query
    c1_id = str(uuid4())
    c2_id = str(uuid4())
    c3_id = str(uuid4())
    concepts_execute = MagicMock()
    concepts_execute.data = [
        {"id": c1_id, "document_id": d1_id},
        {"id": c2_id, "document_id": d2_id},
        {"id": c3_id, "document_id": d2_id},
    ]

    # Mock mastery only for first doc concept; second doc has concepts but no mastery
    mastery_execute = MagicMock()
    mastery_execute.data = [
        {"concept_id": c1_id, "mastery_score": 100, "times_tested": 3},
    ]

    docs_table = MagicMock()
    docs_table.select.return_value.eq.return_value.order.return_value.execute.return_value = docs_execute

    concepts_table = MagicMock()
    concepts_table.select.return_value.in_.return_value.execute.return_value = (
        concepts_execute
    )

    mastery_table = MagicMock()
    mastery_table.select.return_value.eq.return_value.in_.return_value.execute.return_value = mastery_execute

    def table_side_effect(name):
        if name == "documents":
            return docs_table
        if name == "concepts":
            return concepts_table
        if name == "user_concept_mastery":
            return mastery_table
        raise AssertionError(f"Unexpected table requested: {name}")

    mock_supabase.table.side_effect = table_side_effect

    response = client.get("/documents/progress/summary")

    assert response.status_code == 200
    data = response.json()
    docs = data["documents"]
    assert len(docs) == 2

    d1 = next(d for d in docs if d["document_id"] == d1_id)
    assert d1["mastery_percent"] == 100

    d2 = next(d for d in docs if d["document_id"] == d2_id)
    assert d2["mastery_percent"] == 0
    assert d2["concepts_practiced"] == 0
    assert d2["weak_concepts_count"] == 0
