"""Tests for the async generation pipeline introduced in PR4.

Covers:
- check_next_question state mapping
- staleness TTL → mark failed → re-trigger
- generate_next_question_bg idempotency / short-circuit on completed session
- wait_for_next_question polling loop
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services import session_manager


SESSION_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff"
USER_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
DOC_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"
CONCEPT_ID = "11111111-1111-1111-1111-111111111111"


def _make_active_session(total: int = 5, answered: int = 1, correct: int = 1) -> dict:
    return {
        "id": SESSION_ID,
        "user_id": USER_ID,
        "document_id": DOC_ID,
        "status": "active",
        "difficulty": "medium",
        "total_questions": total,
        "answered_questions": answered,
        "correct_answers": correct,
    }


def _make_question_row(status: str, created_at: datetime | None = None) -> dict:
    created = (created_at or datetime.now(timezone.utc)).isoformat()
    return {
        "id": "q-1",
        "session_id": SESSION_ID,
        "question_number": 2,
        "question_type": "text_mcq",
        "question_text": "Q?",
        "options": ["A", "B"],
        "correct_answer": "A",
        "difficulty": "medium",
        "status": status,
        "created_at": created,
        "generation_attempts": 1,
    }


# ---------------------------------------------------------------------------
# check_next_question
# ---------------------------------------------------------------------------


class _FakeSupabase:
    """Hand-rolled stub mirroring the Supabase client surface used by
    `check_next_question`. Each test wires up the table responses it needs."""

    def __init__(self, sessions=None, questions=None):
        self.sessions = sessions or []
        self.questions = questions or []
        self.updates: list[dict] = []

    def table(self, name):
        return _FakeTable(self, name)


class _FakeTable:
    def __init__(self, parent, name):
        self.parent = parent
        self.name = name
        self._filters: list[tuple] = []
        self._select = None
        self._order = None
        self._limit = None
        self._update_payload: dict | None = None
        self._insert_payload: dict | None = None

    def select(self, *args):
        self._select = args
        return self

    def eq(self, k, v):
        self._filters.append(("eq", k, v))
        return self

    def in_(self, k, vs):
        self._filters.append(("in", k, list(vs)))
        return self

    def order(self, *args, **kwargs):
        self._order = (args, kwargs)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def update(self, payload):
        self._update_payload = payload
        return self

    def insert(self, payload):
        self._insert_payload = payload
        return self

    def execute(self):
        # Reads
        if self._select is not None or self._order is not None:
            rows = self.parent.sessions if self.name == "quiz_sessions" else self.parent.questions
            return MagicMock(data=rows)
        # Writes
        if self._update_payload is not None:
            self.parent.updates.append({"table": self.name, "filters": self._filters, "payload": self._update_payload})
            return MagicMock(data=[{"id": "x", **self._update_payload}])
        if self._insert_payload is not None:
            return MagicMock(data=[self._insert_payload])
        return MagicMock(data=[])


def test_check_next_question_returns_ended_when_session_completed():
    sessions = [{**_make_active_session(answered=5), "status": "completed", "ended_reason": "cap_reached"}]
    fake = _FakeSupabase(sessions=sessions)
    with patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.check_next_question(SESSION_ID, USER_ID)
    assert result["status"] == "ended"
    assert result["reason"] == "cap_reached"
    assert "summary" in result


def test_check_next_question_returns_ready_when_row_ready():
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question_row("ready")],
    )
    with patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.check_next_question(SESSION_ID, USER_ID)
    assert result["status"] == "ready"
    assert result["question"]["question_id"] == "q-1"


def test_check_next_question_preparing_when_generating_within_ttl():
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question_row("generating", created_at=datetime.now(timezone.utc))],
    )
    with patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.check_next_question(SESSION_ID, USER_ID)
    assert result["status"] == "preparing"


def test_check_next_question_marks_stale_generating_failed_and_retriggers():
    stale_created = datetime.now(timezone.utc) - timedelta(seconds=120)
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question_row("generating", created_at=stale_created)],
    )
    triggered = []

    def fake_trigger(sid, uid):
        triggered.append((sid, uid))

    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "_trigger_generation_if_needed", fake_trigger):
        result = session_manager.check_next_question(SESSION_ID, USER_ID)

    assert result["status"] == "preparing"
    # An UPDATE setting status='failed' must have been issued for the stale row.
    failed_updates = [u for u in fake.updates if u["payload"].get("status") == "failed"]
    assert failed_updates, "stale generating row should be marked failed"
    assert triggered == [(SESSION_ID, USER_ID)]


def test_check_next_question_returns_failed_for_failed_row():
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question_row("failed")],
    )
    with patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.check_next_question(SESSION_ID, USER_ID)
    assert result["status"] == "failed"
    assert result["error"] == "generator_unavailable"


def test_check_next_question_triggers_when_no_row():
    fake = _FakeSupabase(sessions=[_make_active_session()], questions=[])
    triggered = []

    def fake_trigger(sid, uid):
        triggered.append((sid, uid))

    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "_trigger_generation_if_needed", fake_trigger):
        result = session_manager.check_next_question(SESSION_ID, USER_ID)

    assert result["status"] == "preparing"
    assert triggered == [(SESSION_ID, USER_ID)]


# ---------------------------------------------------------------------------
# generate_next_question_bg
# ---------------------------------------------------------------------------


def test_bg_short_circuits_when_session_completed():
    sessions = [{**_make_active_session(), "status": "completed"}]
    fake = _FakeSupabase(sessions=sessions)
    selector_called = []
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(
             session_manager, "_select_next_concept",
             side_effect=lambda *a, **kw: selector_called.append(True) or {"id": CONCEPT_ID, "concept_name": "X"},
         ), \
         patch.object(session_manager, "generate_single_question") as gen_mock:
        session_manager.generate_next_question_bg(SESSION_ID, USER_ID)
    assert selector_called == [], "selector must not run on completed session"
    gen_mock.assert_not_called()


def test_bg_short_circuits_when_cap_reached():
    """answered >= total_questions → no generation."""
    sessions = [_make_active_session(total=2, answered=2, correct=2)]
    fake = _FakeSupabase(sessions=sessions, questions=[])

    def fake_counts(sid):
        return (2, 2)

    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "_recompute_session_counts", fake_counts), \
         patch.object(session_manager, "_select_next_concept") as sel_mock, \
         patch.object(session_manager, "generate_single_question") as gen_mock:
        session_manager.generate_next_question_bg(SESSION_ID, USER_ID)
    sel_mock.assert_not_called()
    gen_mock.assert_not_called()


# ---------------------------------------------------------------------------
# wait_for_next_question
# ---------------------------------------------------------------------------


def test_wait_returns_immediately_when_ready(monkeypatch):
    monkeypatch.setattr(
        session_manager,
        "check_next_question",
        lambda sid, uid: {"status": "ready", "question": {"question_id": "q1", "question_number": 1, "total_questions": 5, "question_type": "text_mcq", "question_text": "?", "difficulty": "medium"}},
    )
    result = session_manager.wait_for_next_question(SESSION_ID, USER_ID, wait_ms=2000)
    assert result["status"] == "ready"


def test_wait_returns_preparing_after_timeout(monkeypatch):
    monkeypatch.setattr(
        session_manager,
        "check_next_question",
        lambda sid, uid: {"status": "preparing"},
    )
    # Tiny wait so the test runs fast
    result = session_manager.wait_for_next_question(SESSION_ID, USER_ID, wait_ms=200)
    assert result["status"] == "preparing"
    assert result.get("retry_after_ms") == 500
