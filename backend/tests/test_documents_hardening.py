from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

import app.config

app.config.get_settings = lambda: app.config.Settings(
    qdrant_url="http://test",
    qdrant_api_key="test",
    kimi_api_key="test",
    max_document_mb=10,
    max_documents_per_user=10,
)

from app.api.routes.documents import get_user_id_from_token
from app.api.routes import documents
from app.main import app


client = TestClient(app)
user_id = str(uuid4())


async def override_get_user_id_from_token():
    return user_id


app.dependency_overrides[get_user_id_from_token] = override_get_user_id_from_token


def _document_row(filename="notes.pdf", file_type="pdf", file_size=7):
    return {
        "id": str(uuid4()),
        "filename": filename,
        "file_type": file_type,
        "file_size": file_size,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "ai_title": None,
    }


def test_register_document_rejects_path_traversal_before_storage_check(mocker):
    mock_supabase = mocker.patch.object(documents, "supabase_admin")
    enforce = mocker.patch.object(documents, "enforce_max_documents")

    response = client.post(
        "/documents/register",
        json={
            "filename": "notes.pdf",
            "file_path": f"{user_id}/../other-user/notes.pdf",
            "file_type": "pdf",
            "file_size": 7,
        },
    )

    assert response.status_code == 400
    assert "Invalid file path" in response.json()["detail"]
    enforce.assert_not_called()
    mock_supabase.storage.from_.assert_not_called()


def test_upload_document_rejects_disallowed_content_type_before_read(mocker):
    mocker.patch.object(documents, "supabase_admin")
    enforce = mocker.patch.object(documents, "enforce_max_documents")

    response = client.post(
        "/documents/upload",
        files={"file": ("notes.pdf", b"%PDF-1.7", "text/plain")},
    )

    assert response.status_code == 400
    assert "Invalid content type" in response.json()["detail"]
    enforce.assert_not_called()


def test_upload_document_returns_generic_detail_for_storage_errors(mocker, caplog):
    mock_supabase = mocker.patch.object(documents, "supabase_admin")
    mocker.patch.object(documents, "enforce_max_documents")

    storage_bucket = mock_supabase.storage.from_.return_value
    storage_bucket.upload.return_value = SimpleNamespace(error="secret bucket error")
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
        _document_row()
    ]

    response = client.post(
        "/documents/upload",
        files={"file": ("notes.pdf", b"%PDF-1.7", "application/pdf")},
    )

    assert response.status_code == 500
    assert response.json()["detail"] == "Upload failed"
    assert "secret bucket error" not in response.text
    assert "secret bucket error" in caplog.text
