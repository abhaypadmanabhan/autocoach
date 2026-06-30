"""Tests for the Smart Review MVP: doc auto-pick + review-scoped selector."""

from unittest.mock import patch, MagicMock

from app.services import session_manager


USER = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
DOC_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
DOC_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
C1 = "11111111-1111-1111-1111-111111111111"
C2 = "22222222-2222-2222-2222-222222222222"
C3 = "33333333-3333-3333-3333-333333333333"


def _due(cid, doc, last):
    return {"id": cid, "document_id": doc, "last_tested_at": last, "mastery_score": 10.0}


def test_pick_review_document_picks_most_due_ready_doc():
    due = [
        _due(C1, DOC_A, "2026-06-01T00:00:00+00:00"),
        _due(C2, DOC_A, "2026-06-02T00:00:00+00:00"),
        _due(C3, DOC_B, "2026-06-03T00:00:00+00:00"),
    ]
    docs_resp = MagicMock()
    docs_resp.data = [{"id": DOC_A, "status": "ready"}, {"id": DOC_B, "status": "ready"}]
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.in_.return_value.eq.return_value.execute.return_value = docs_resp
    with patch.object(session_manager, "get_due_concepts", return_value=due), \
         patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.pick_review_document(USER)
    assert result is not None
    doc_id, due_ids = result
    assert doc_id == DOC_A  # 2 due > 1 due
    assert set(due_ids) == {C1, C2}


def test_pick_review_document_skips_non_ready_doc():
    due = [
        _due(C1, DOC_A, "2026-06-01T00:00:00+00:00"),
        _due(C2, DOC_A, "2026-06-02T00:00:00+00:00"),
        _due(C3, DOC_B, "2026-06-03T00:00:00+00:00"),
    ]
    docs_resp = MagicMock()
    docs_resp.data = [{"id": DOC_B, "status": "ready"}]  # DOC_A not ready / deleted
    fake = MagicMock()
    fake.table.return_value.select.return_value.eq.return_value.in_.return_value.eq.return_value.execute.return_value = docs_resp
    with patch.object(session_manager, "get_due_concepts", return_value=due), \
         patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.pick_review_document(USER)
    assert result is not None
    assert result[0] == DOC_B


def test_pick_review_document_none_when_nothing_due():
    with patch.object(session_manager, "get_due_concepts", return_value=[]):
        assert session_manager.pick_review_document(USER) is None


def test_selector_review_mode_restricts_to_due_concepts():
    concepts = [
        {"id": C1, "concept_name": "c1", "importance_score": 1.0, "is_core": True, "mastery_score": 10.0},
        {"id": C2, "concept_name": "c2", "importance_score": 1.0, "is_core": True, "mastery_score": 90.0},
    ]
    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_due_concept_ids_for_document", return_value={C2}), \
         patch.object(session_manager, "_get_session_question_history", return_value=[]):
        chosen = session_manager._select_next_concept("sess", USER, DOC_A, session_type="review")
    assert chosen["id"] == C2  # only the due concept, even though it has high mastery


def test_selector_review_mode_falls_back_to_core_when_due_empty():
    concepts = [
        {"id": C1, "concept_name": "c1", "importance_score": 1.0, "is_core": True, "mastery_score": 10.0},
    ]
    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_due_concept_ids_for_document", return_value=set()), \
         patch.object(session_manager, "_get_session_question_history", return_value=[]):
        chosen = session_manager._select_next_concept("sess", USER, DOC_A, session_type="review")
    assert chosen["id"] == C1  # falls back to normal core pool


def test_selector_standard_mode_unaffected():
    """Standard mode ignores due-concept scoping entirely."""
    concepts = [
        {"id": C1, "concept_name": "c1", "importance_score": 1.0, "is_core": True, "mastery_score": 10.0},
    ]
    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_due_concept_ids_for_document") as due_mock, \
         patch.object(session_manager, "_get_session_question_history", return_value=[]):
        chosen = session_manager._select_next_concept("sess", USER, DOC_A)
    assert chosen["id"] == C1
    due_mock.assert_not_called()  # never consults due set in standard mode


# --- Route: review branch + quota carve-out -------------------------------

from fastapi.testclient import TestClient


def _client_with_user():
    import app.config
    from unittest.mock import MagicMock as MM
    app.config.get_settings = lambda: MM(
        supabase_url="http://test", supabase_publishable_key="test",
        supabase_secret_key="test", qdrant_url="http://test", qdrant_api_key="test",
        kimi_api_key="test", max_document_mb=10, max_documents_per_user=10,
        max_quiz_sessions_per_day=5, quiz_requests_per_minute=60, environment="test",
    )
    from app.main import app
    from app.api.routes.documents import get_user_id_from_token

    async def _override():
        return USER

    app.dependency_overrides[get_user_id_from_token] = _override
    return TestClient(app)


def test_review_session_skips_quota(mocker):
    client = _client_with_user()
    from app.api.routes import sessions as sessions_route

    mocker.patch.object(sessions_route, "pick_review_document", return_value=(DOC_A, [C1, C2]))
    create_mock = mocker.patch.object(
        sessions_route, "create_session",
        return_value={"session_id": "sess-rev", "document_id": DOC_A,
                      "difficulty": "medium", "total_questions": 2, "first_question": None},
    )
    consume_mock = mocker.patch.object(sessions_route, "consume_quiz_usage_or_429")

    resp = client.post("/quiz/sessions/", json={"mode": "review"})

    assert resp.status_code == 200
    consume_mock.assert_not_called()                      # review is FREE
    create_mock.assert_called_once()
    kwargs = create_mock.call_args.kwargs
    assert kwargs["session_type"] == "review"
    assert kwargs["document_id"] == DOC_A
    assert kwargs["num_questions"] == 2                    # min(len(due), 10)


def test_review_session_404_when_nothing_due(mocker):
    client = _client_with_user()
    from app.api.routes import sessions as sessions_route
    mocker.patch.object(sessions_route, "pick_review_document", return_value=None)
    resp = client.post("/quiz/sessions/", json={"mode": "review"})
    assert resp.status_code == 404


def test_standard_session_requires_document_id(mocker):
    client = _client_with_user()
    resp = client.post("/quiz/sessions/", json={"num_questions": 5})  # no document_id
    assert resp.status_code == 400
