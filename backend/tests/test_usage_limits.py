from unittest.mock import MagicMock
from types import SimpleNamespace
from uuid import uuid4

from fastapi import HTTPException
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
from app.api.routes import sprints as sprints_route
from app.api.routes import sessions as sessions_route
from app.services.usage import is_pro


client = TestClient(app)
user_id = str(uuid4())


async def override_get_user_id_from_token():
    return user_id


app.dependency_overrides[get_user_id_from_token] = override_get_user_id_from_token


def _limit_detail(limit_type: str, limit: int, message: str) -> dict:
    return {
        "error": "daily_limit_reached",
        "type": limit_type,
        "limit": limit,
        "message": message,
    }


def _mock_sessions_supabase(doc_status: str = "ready") -> MagicMock:
    mock_supabase = MagicMock()

    documents_table = MagicMock()
    documents_table.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": str(uuid4()),
            "user_id": user_id,
            "status": doc_status,
        }
    ]

    questions_table = MagicMock()
    questions_table.delete.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[])
    )

    quiz_sessions_table = MagicMock()
    quiz_sessions_table.delete.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[])
    )

    def table_side_effect(name: str):
        if name == "documents":
            return documents_table
        if name == "questions":
            return questions_table
        if name == "quiz_sessions":
            return quiz_sessions_table
        return MagicMock()

    mock_supabase.table.side_effect = table_side_effect
    return mock_supabase


def _mock_sprints_supabase() -> MagicMock:
    mock_supabase = MagicMock()
    questions_table = MagicMock()
    questions_table.delete.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[])
    )
    quiz_sessions_table = MagicMock()
    quiz_sessions_table.delete.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[])
    )

    def table_side_effect(name: str):
        if name == "questions":
            return questions_table
        if name == "quiz_sessions":
            return quiz_sessions_table
        return MagicMock()

    mock_supabase.table.side_effect = table_side_effect
    return mock_supabase


def test_start_sprint_returns_429_with_structured_detail(mocker):
    detail = _limit_detail("sprint", 1, "You've reached your daily sprint limit.")
    mocker.patch.object(sprints_route, "supabase_admin", _mock_sprints_supabase())
    mocker.patch.object(sprints_route, "_get_today_session", return_value=None)
    mocker.patch.object(
        sprints_route,
        "start_sprint_session",
        return_value=SimpleNamespace(
            session_id="sess-1",
            document_id="doc-1",
            document_title="Title",
            questions=[],
        ),
    )
    mocker.patch.object(
        sprints_route,
        "consume_sprint_usage_or_429",
        side_effect=HTTPException(status_code=429, detail=detail),
    )

    response = client.post("/sprint/start", json={})

    assert response.status_code == 429
    assert response.json()["detail"] == detail


def test_start_sprint_retry_returns_existing_session_without_reconsume(mocker):
    existing = {
        "id": "sess-existing",
        "document_id": "doc-1",
        "status": "active",
        "difficulty": "medium",
        "total_questions": 5,
    }

    mocker.patch.object(sprints_route, "_get_today_session", return_value=existing)
    mocker.patch.object(
        sprints_route,
        "_fetch_session_questions",
        return_value=(
            [
                {
                    "question_id": "q-1",
                    "question_number": 1,
                    "total_questions": 5,
                    "question_type": "mcq",
                    "question_text": "Q",
                    "options": ["A", "B"],
                    "difficulty": "medium",
                }
            ],
            0,
            1,
        ),
    )
    mocker.patch.object(sprints_route, "_get_document_title", return_value="Doc")
    start_mock = mocker.patch.object(sprints_route, "start_sprint_session")
    consume_mock = mocker.patch.object(sprints_route, "consume_sprint_usage_or_429")

    response = client.post("/sprint/start", json={})

    assert response.status_code == 200
    assert response.json()["session_id"] == "sess-existing"
    start_mock.assert_not_called()
    consume_mock.assert_not_called()


def test_create_quiz_session_returns_429_with_structured_detail(mocker):
    detail = _limit_detail("quiz", 5, "You've reached your daily quiz limit.")

    mocker.patch.object(sessions_route, "supabase_admin", _mock_sessions_supabase())
    mocker.patch.object(
        sessions_route,
        "create_session",
        return_value={
            "session_id": "sess-quiz",
            "document_id": str(uuid4()),
            "difficulty": "medium",
            "total_questions": 5,
            "first_question": None,
        },
    )
    mocker.patch.object(
        sessions_route,
        "consume_quiz_usage_or_429",
        side_effect=HTTPException(status_code=429, detail=detail),
    )

    response = client.post(
        "/quiz/sessions/",
        json={"document_id": str(uuid4()), "num_questions": 5},
    )

    assert response.status_code == 429
    assert response.json()["detail"] == detail


def test_create_quiz_session_consumes_quota_after_success(mocker):
    mocker.patch.object(sessions_route, "supabase_admin", _mock_sessions_supabase())
    create_mock = mocker.patch.object(
        sessions_route,
        "create_session",
        return_value={
            "session_id": "sess-quiz",
            "document_id": str(uuid4()),
            "difficulty": "medium",
            "total_questions": 5,
            "first_question": None,
        },
    )
    consume_mock = mocker.patch.object(
        sessions_route,
        "consume_quiz_usage_or_429",
        return_value=1,
    )

    response = client.post(
        "/quiz/sessions/",
        json={"document_id": str(uuid4()), "num_questions": 5},
    )

    assert response.status_code == 200
    create_mock.assert_called_once()
    consume_mock.assert_called_once()


def test_is_pro_helper():
    assert is_pro("pro") is True
    assert is_pro("Pro") is True  # case insensitive
    assert is_pro(" PRO ") is True  # strip whitespace
    assert is_pro("free") is False
    assert is_pro(None) is False
    assert is_pro("") is False


def test_consume_sprint_usage_bypasses_limit_for_pro_user(mocker):
    # Mock user as Pro
    mocker.patch("app.services.usage.is_pro_user", return_value=True)
    
    # Mock verify limits would be hit if checked (though logic shouldn't check DB count if pro)
    # We'll mock the internal usage checkout to ensure it proceeds
    mocker.patch.object(sprints_route, "consume_sprint_usage_or_429", return_value=0)
    
    # But specifically for the usage service itself, let's test the lower level service function 
    # to ensure IT bypasses.
    from app.services.usage import consume_sprint_usage_or_429
    
    # If is_pro_user is True, it should return 0 and NOT raise exception
    # even if we didn't mock the DB calls because it returns early.
    val = consume_sprint_usage_or_429(uuid4())
    assert val == 0


def test_consume_quiz_usage_bypasses_limit_for_pro_user(mocker):
    # Mock user as Pro
    mocker.patch("app.services.usage.is_pro_user", return_value=True)
    
    from app.services.usage import consume_quiz_usage_or_429
    
    val = consume_quiz_usage_or_429(uuid4())
    assert val == 0
