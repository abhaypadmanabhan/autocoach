"""Tests for async free-text answer evaluation (issue #22) and the
wrong-answer bias boost in the concept selector (issue #24).

Async-eval design (no schema change): a `text_free` answer is recorded fast
with `status='answered'` and `is_correct=NULL` (the pending-eval marker) and
graded off the request path by `evaluate_answer_bg`. `check_answer_verdict` /
`wait_for_answer_verdict` long-poll for the verdict and self-heal a dropped
eval via the stale-TTL, mirroring the async generation FSM.
"""

import random
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services import session_manager


SESSION_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff"
USER_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
DOC_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"
QUESTION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
CONCEPT_ID = "11111111-1111-1111-1111-111111111111"


def _make_active_session(total: int = 5, answered: int = 1, correct: int = 1, status: str = "active") -> dict:
    return {
        "id": SESSION_ID,
        "user_id": USER_ID,
        "document_id": DOC_ID,
        "status": status,
        "difficulty": "medium",
        "total_questions": total,
        "answered_questions": answered,
        "correct_answers": correct,
    }


def _make_question(
    qtype: str = "text_free",
    user_answer=None,
    is_correct=None,
    answered_at: datetime | None = None,
) -> dict:
    return {
        "id": QUESTION_ID,
        "session_id": SESSION_ID,
        "question_number": 2,
        "question_type": qtype,
        "question_text": "What is X?",
        "options": None,
        "correct_answer": "the model answer",
        "explanation": "because reasons",
        "concept_ids": [CONCEPT_ID],
        "user_answer": user_answer,
        "is_correct": is_correct,
        "status": "ready" if user_answer is None else "answered",
        "answered_at": answered_at.isoformat() if answered_at else None,
    }


class _FakeSupabase:
    """Minimal Supabase stub. Reads return the list for the table; writes are
    recorded on `.updates` / `.inserts`. Rows are shared references, so a test
    can mutate `fake.questions[0]` between calls to simulate the verdict
    landing."""

    def __init__(self, sessions=None, questions=None):
        self.sessions = sessions or []
        self.questions = questions or []
        self.updates: list[dict] = []
        self.inserts: list[dict] = []

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
        self._update_payload = None
        self._insert_payload = None

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

    def not_(self):  # pragma: no cover - unused surface guard
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
        if self._update_payload is not None:
            self.parent.updates.append(
                {"table": self.name, "filters": self._filters, "payload": self._update_payload}
            )
            return MagicMock(data=[{"id": "x", **self._update_payload}])
        if self._insert_payload is not None:
            self.parent.inserts.append({"table": self.name, "payload": self._insert_payload})
            return MagicMock(data=[self._insert_payload])
        rows = self.parent.sessions if self.name == "quiz_sessions" else self.parent.questions
        return MagicMock(data=list(rows))


# ---------------------------------------------------------------------------
# submit_answer — fast path split
# ---------------------------------------------------------------------------


def test_submit_answer_text_free_returns_pending_without_llm_call():
    """text_free is recorded fast: NO inline LLM eval, is_correct stays NULL,
    eval_status='pending'."""
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_free")],
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "evaluate_answer") as eval_mock, \
         patch.object(session_manager, "_recompute_session_counts", return_value=(2, 1)):
        result = session_manager.submit_answer(
            SESSION_ID, USER_ID, QUESTION_ID, "my free answer", "typed"
        )

    eval_mock.assert_not_called()  # the whole point: no LLM on the request path
    assert result["eval_status"] == "pending"
    assert result["result"]["is_correct"] is None
    assert result["session_complete"] is False

    # The question row must be flipped to answered with is_correct NULL.
    q_updates = [u for u in fake.updates if u["table"] == "questions"]
    assert q_updates, "expected a questions update"
    payload = q_updates[0]["payload"]
    assert payload["user_answer"] == "my free answer"
    assert payload["is_correct"] is None
    assert payload["status"] == "answered"
    assert payload["answered_at"] is not None


def test_submit_answer_text_free_does_not_finalize_session():
    """The fast path must NOT run mastery/completion — that's the eval task's
    job once the verdict lands."""
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_free")],
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "evaluate_answer"), \
         patch.object(session_manager, "_recompute_session_counts", return_value=(2, 1)), \
         patch.object(session_manager, "_finalize_answer") as finalize_mock:
        session_manager.submit_answer(SESSION_ID, USER_ID, QUESTION_ID, "ans", "typed")

    finalize_mock.assert_not_called()


def test_submit_answer_mcq_inline_complete():
    """MCQ is graded inline and fully finalized; eval_status='complete'."""
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_mcq", user_answer=None)],
    )
    finalized = {
        "result": {
            "is_correct": True,
            "correct_answer": "A",
            "explanation": "x",
            "score_so_far": 2,
            "total_answered": 2,
            "feedback": "Correct!",
            "xp_awarded": 10,
            "mastery_delta": 1.0,
        },
        "session_complete": False,
        "session_ended_reason": None,
    }
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(
             session_manager, "evaluate_answer",
             return_value={"is_correct": True, "feedback": "Correct!"},
         ) as eval_mock, \
         patch.object(session_manager, "_finalize_answer", return_value=finalized):
        result = session_manager.submit_answer(SESSION_ID, USER_ID, QUESTION_ID, "A", "click")

    eval_mock.assert_called_once()
    assert result["eval_status"] == "complete"
    assert result["result"]["is_correct"] is True


def test_submit_answer_rejects_already_answered():
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_free", user_answer="already")],
    )
    with patch.object(session_manager, "supabase_admin", fake):
        with pytest.raises(ValueError, match="already answered"):
            session_manager.submit_answer(SESSION_ID, USER_ID, QUESTION_ID, "again", "typed")


# ---------------------------------------------------------------------------
# evaluate_answer_bg — background grading
# ---------------------------------------------------------------------------


def test_evaluate_answer_bg_grades_finalizes_and_triggers_next():
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_free", user_answer="student answer")],
    )
    finalized = {
        "result": {"is_correct": True},
        "session_complete": False,
        "session_ended_reason": None,
    }
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(
             session_manager, "evaluate_answer",
             return_value={"is_correct": True, "feedback": "good"},
         ) as eval_mock, \
         patch.object(session_manager, "_finalize_answer", return_value=finalized) as fin_mock, \
         patch.object(session_manager, "generate_next_question_bg") as gen_mock:
        session_manager.evaluate_answer_bg(SESSION_ID, USER_ID, QUESTION_ID)

    eval_mock.assert_called_once()
    # is_correct verdict written back onto the question row.
    q_updates = [u for u in fake.updates if u["table"] == "questions"]
    assert any(u["payload"].get("is_correct") is True for u in q_updates)
    fin_mock.assert_called_once()
    gen_mock.assert_called_once_with(SESSION_ID, USER_ID)


def test_evaluate_answer_bg_does_not_trigger_next_when_complete():
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_free", user_answer="student answer")],
    )
    finalized = {"result": {"is_correct": False}, "session_complete": True, "session_ended_reason": "cap_reached"}
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "evaluate_answer", return_value={"is_correct": False, "feedback": "no"}), \
         patch.object(session_manager, "_finalize_answer", return_value=finalized), \
         patch.object(session_manager, "generate_next_question_bg") as gen_mock:
        session_manager.evaluate_answer_bg(SESSION_ID, USER_ID, QUESTION_ID)

    gen_mock.assert_not_called()


def test_evaluate_answer_bg_idempotent_when_already_graded():
    """A late/duplicate eval task must not re-grade an already-graded answer."""
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_free", user_answer="a", is_correct=True)],
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "evaluate_answer") as eval_mock, \
         patch.object(session_manager, "_finalize_answer") as fin_mock:
        session_manager.evaluate_answer_bg(SESSION_ID, USER_ID, QUESTION_ID)

    eval_mock.assert_not_called()
    fin_mock.assert_not_called()


def test_evaluate_answer_bg_skips_when_no_answer():
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_free", user_answer=None)],
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "evaluate_answer") as eval_mock:
        session_manager.evaluate_answer_bg(SESSION_ID, USER_ID, QUESTION_ID)

    eval_mock.assert_not_called()


# ---------------------------------------------------------------------------
# check_answer_verdict / wait_for_answer_verdict
# ---------------------------------------------------------------------------


def test_check_answer_verdict_pending_while_ungraded():
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(user_answer="a", is_correct=None, answered_at=datetime.now(timezone.utc))],
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "evaluate_answer_bg") as heal_mock:
        result = session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)

    assert result["eval_status"] == "pending"
    assert result["result"]["is_correct"] is None
    heal_mock.assert_not_called()  # fresh, within TTL — no self-heal


def test_check_answer_verdict_complete_once_graded():
    session = _make_active_session(total=5, answered=2, correct=2)
    fake = _FakeSupabase(
        sessions=[session],
        questions=[_make_question(user_answer="a", is_correct=True, answered_at=datetime.now(timezone.utc))],
    )
    with patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)

    assert result["eval_status"] == "complete"
    assert result["result"]["is_correct"] is True
    assert result["result"]["xp_awarded"] == 10
    assert result["result"]["score_so_far"] == 2
    assert result["session_complete"] is False


def test_check_answer_verdict_reports_session_complete():
    session = _make_active_session(total=2, answered=2, correct=1, status="completed")
    fake = _FakeSupabase(
        sessions=[session],
        questions=[_make_question(user_answer="a", is_correct=False, answered_at=datetime.now(timezone.utc))],
    )
    with patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)

    assert result["eval_status"] == "complete"
    assert result["session_complete"] is True
    assert result["session_ended_reason"] == "cap_reached"


def test_check_answer_verdict_self_heals_stale_eval():
    """An ungraded answer older than the stale-TTL re-drives the eval task."""
    stale = datetime.now(timezone.utc) - timedelta(seconds=120)
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(user_answer="a", is_correct=None, answered_at=stale)],
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "evaluate_answer_bg") as heal_mock:
        result = session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)

    assert result["eval_status"] == "pending"
    heal_mock.assert_called_once_with(SESSION_ID, USER_ID, QUESTION_ID)


def test_wait_for_answer_verdict_returns_complete(monkeypatch):
    monkeypatch.setattr(
        session_manager,
        "check_answer_verdict",
        lambda sid, uid, qid: {
            "eval_status": "complete",
            "result": {"is_correct": True},
            "session_complete": False,
            "session_ended_reason": None,
        },
    )
    result = session_manager.wait_for_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID, wait_ms=2000)
    assert result["eval_status"] == "complete"


def test_wait_for_answer_verdict_returns_pending_after_timeout(monkeypatch):
    monkeypatch.setattr(
        session_manager,
        "check_answer_verdict",
        lambda sid, uid, qid: {
            "eval_status": "pending",
            "result": {"is_correct": None},
            "session_complete": False,
            "session_ended_reason": None,
        },
    )
    result = session_manager.wait_for_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID, wait_ms=200)
    assert result["eval_status"] == "pending"
    assert result.get("retry_after_ms") == 500
