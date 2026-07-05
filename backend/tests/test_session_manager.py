"""Tests for async free-text answer evaluation (issue #22) and the
wrong-answer bias boost in the concept selector (issue #24).

Async-eval design: a `text_free` answer is recorded fast with
`status='answered'` and `is_correct=NULL` (the pending-eval marker) and graded
off the request path by `evaluate_answer_bg`, which finalizes exactly once via
a conditional verdict write (`is_correct IS NULL`) and persists feedback /
mastery_delta / xp into `questions.eval_result` (jsonb). `check_answer_verdict`
/ `wait_for_answer_verdict` long-poll for the verdict; pending payloads are
neutral (no correct_answer/explanation). A stale pending eval is healed via an
atomic answered_at-bump claim + daemon-thread re-drive, attempts-capped with a
fail-closed terminal state; `check_next_question` / `get_current_question` are
additional heal entry points (restart-lost BackgroundTasks) and never trigger
generation while an eval is pending.
"""

import random
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services import quiz_generator, session_manager


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
    eval_result: dict | None = None,
    question_number: int = 2,
    qid: str = QUESTION_ID,
) -> dict:
    return {
        "id": qid,
        "session_id": SESSION_ID,
        "question_number": question_number,
        "question_type": qtype,
        "question_text": "What is X?",
        "options": None,
        "correct_answer": "the model answer",
        "explanation": "because reasons",
        "concept_ids": [CONCEPT_ID],
        "user_answer": user_answer,
        "is_correct": is_correct,
        "eval_result": eval_result,
        "status": "ready" if user_answer is None else "answered",
        "answered_at": answered_at.isoformat() if answered_at else None,
    }


def _row_matches(row: dict, filters: list[tuple]) -> bool:
    for op, key, val in filters:
        actual = row.get(key)
        if op == "eq":
            if str(actual) != str(val):
                return False
        elif op == "in":
            if str(actual) not in {str(v) for v in val}:
                return False
        elif op == "is":
            if val in (None, "null") and actual is not None:
                return False
        elif op == "not.is":
            if val in (None, "null") and actual is None:
                return False
        elif op == "lt":
            if actual is None or not (str(actual) < str(val)):
                return False
    return True


class _FakeSupabase:
    """Supabase stub with filter-aware reads and conditional updates.

    Reads apply eq/in/is/lt filters against the table rows (shared dict
    references, so a test can mutate `fake.questions[0]` between calls to
    simulate the verdict landing). Updates are recorded on `.updates`, applied
    to the matching rows, and return exactly those rows — so a conditional
    update (e.g. `.is_("is_correct", "null")`) returns empty data when no row
    matches, mirroring the atomic-claim semantics under test. `update_hook`
    (table, filters, payload) -> list | None can force an update result (e.g.
    [] to simulate losing a claim race) without touching rows."""

    def __init__(self, sessions=None, questions=None, update_hook=None):
        self.sessions = sessions or []
        self.questions = questions or []
        self.updates: list[dict] = []
        self.inserts: list[dict] = []
        self.update_hook = update_hook

    def table(self, name):
        return _FakeTable(self, name)

    def rows_for(self, name):
        return self.sessions if name == "quiz_sessions" else self.questions


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
        self._negate_next = False

    def select(self, *args):
        self._select = args
        return self

    def _add_filter(self, op, k, v):
        if self._negate_next:
            op = f"not.{op}"
            self._negate_next = False
        self._filters.append((op, k, v))
        return self

    def eq(self, k, v):
        return self._add_filter("eq", k, v)

    def in_(self, k, vs):
        return self._add_filter("in", k, list(vs))

    def is_(self, k, v):
        return self._add_filter("is", k, v)

    def lt(self, k, v):
        return self._add_filter("lt", k, v)

    def order(self, *args, **kwargs):
        self._order = (args, kwargs)
        return self

    @property
    def not_(self):
        self._negate_next = True
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
            if self.parent.update_hook is not None:
                hooked = self.parent.update_hook(
                    self.name, self._filters, self._update_payload
                )
                if hooked is not None:
                    return MagicMock(data=hooked)
            matched = [
                r for r in self.parent.rows_for(self.name)
                if _row_matches(r, self._filters)
            ]
            for r in matched:
                r.update(self._update_payload)
            return MagicMock(data=[dict(r) for r in matched])
        if self._insert_payload is not None:
            self.parent.inserts.append({"table": self.name, "payload": self._insert_payload})
            return MagicMock(data=[self._insert_payload])
        rows = [
            r for r in self.parent.rows_for(self.name)
            if _row_matches(r, self._filters)
        ]
        if self._order:
            order_args, order_kwargs = self._order
            if order_args:
                key = order_args[0]
                rows = sorted(
                    rows,
                    key=lambda r: (r.get(key) is None, r.get(key)),
                    reverse=bool(order_kwargs.get("desc")),
                )
        if self._limit is not None:
            rows = rows[: self._limit]
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


def test_evaluate_answer_bg_lost_verdict_race_does_not_finalize():
    """Exactly-once finalize: when the conditional verdict write matches zero
    rows (a racing worker — duplicate task or stale-TTL re-drive — graded the
    answer first), the loser must NOT finalize (mastery would double-count)
    and must NOT trigger generation."""

    def lose_verdict_write(table, filters, payload):
        if table == "questions" and "is_correct" in payload:
            return []  # racing worker already wrote the verdict
        return None

    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_free", user_answer="student answer")],
        update_hook=lose_verdict_write,
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(
             session_manager, "evaluate_answer",
             return_value={"is_correct": True, "feedback": "good"},
         ) as eval_mock, \
         patch.object(session_manager, "_finalize_answer") as fin_mock, \
         patch.object(session_manager, "generate_next_question_bg") as gen_mock:
        session_manager.evaluate_answer_bg(SESSION_ID, USER_ID, QUESTION_ID)

    eval_mock.assert_called_once()  # this worker paid one LLM call, no more
    fin_mock.assert_not_called()
    gen_mock.assert_not_called()
    # The verdict write must be conditional on the answer being ungraded.
    verdict_writes = [
        u for u in fake.updates
        if u["table"] == "questions" and "is_correct" in u["payload"]
    ]
    assert len(verdict_writes) == 1
    assert ("is", "is_correct", "null") in verdict_writes[0]["filters"]


def test_evaluate_answer_bg_persists_eval_result():
    """After winning the verdict write + finalizing, the real feedback /
    mastery_delta / xp are persisted onto the question row for the poller."""
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_free", user_answer="student answer")],
    )
    finalized = {
        "result": {"is_correct": True, "mastery_delta": 2.75, "xp_awarded": 10},
        "session_complete": True,
        "session_ended_reason": "cap_reached",
    }
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(
             session_manager, "evaluate_answer",
             return_value={"is_correct": True, "feedback": "well reasoned"},
         ), \
         patch.object(session_manager, "_finalize_answer", return_value=finalized):
        session_manager.evaluate_answer_bg(SESSION_ID, USER_ID, QUESTION_ID)

    stored = [
        u["payload"]["eval_result"]
        for u in fake.updates
        if u["table"] == "questions" and "eval_result" in u["payload"]
    ]
    assert stored == [
        {"feedback": "well reasoned", "mastery_delta": 2.75, "xp_awarded": 10}
    ]


# ---------------------------------------------------------------------------
# pending-eval gate + restart self-heal from /next and /current
# ---------------------------------------------------------------------------


def test_generate_next_question_bg_defers_while_eval_pending():
    """The generator must not claim a slot (and select on pre-verdict mastery)
    while an answer eval is pending — the eval task re-triggers it once the
    verdict lands."""
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(user_answer="a", is_correct=None)],
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "_select_next_concept") as sel_mock, \
         patch.object(session_manager, "generate_single_question") as gen_mock:
        session_manager.generate_next_question_bg(SESSION_ID, USER_ID)

    sel_mock.assert_not_called()
    gen_mock.assert_not_called()
    assert fake.inserts == [], "no generation placeholder may be claimed"


def test_check_next_question_heals_stale_pending_eval_and_waits():
    """GET /next is a re-drive path for a restart-lost eval: a stale pending
    answer gets healed (claim + daemon-thread re-drive) and the poller sees
    'preparing' — generation is NOT triggered on unsettled mastery."""
    stale = datetime.now(timezone.utc) - timedelta(seconds=120)
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(user_answer="a", is_correct=None, answered_at=stale)],
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "_spawn_bg") as spawn_mock, \
         patch.object(session_manager, "_trigger_generation_if_needed") as trig_mock:
        result = session_manager.check_next_question(SESSION_ID, USER_ID)

    assert result["status"] == "preparing"
    spawn_mock.assert_called_once()
    assert spawn_mock.call_args.args == (
        session_manager.evaluate_answer_bg, SESSION_ID, USER_ID, QUESTION_ID,
    )
    trig_mock.assert_not_called()


def test_get_current_question_heals_stale_pending_eval_and_waits():
    """GET /current likewise heals a stale pending eval instead of triggering
    generation on unsettled mastery."""
    stale = datetime.now(timezone.utc) - timedelta(seconds=120)
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(user_answer="a", is_correct=None, answered_at=stale)],
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "_spawn_bg") as spawn_mock, \
         patch.object(session_manager, "_trigger_generation_if_needed") as trig_mock:
        result = session_manager.get_current_question(SESSION_ID, USER_ID)

    assert result is None
    spawn_mock.assert_called_once()
    trig_mock.assert_not_called()


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


def test_check_answer_verdict_self_heals_stale_eval_in_background():
    """An ungraded answer older than the stale-TTL is claimed atomically
    (conditional answered_at bump) and re-driven in a daemon thread — the LLM
    must never run inline on the poll request thread."""
    stale = datetime.now(timezone.utc) - timedelta(seconds=120)
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(user_answer="a", is_correct=None, answered_at=stale)],
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "_spawn_bg") as spawn_mock, \
         patch.object(session_manager, "evaluate_answer") as llm_mock:
        result = session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)

    assert result["eval_status"] == "pending"

    # Exactly one atomic claim: answered_at bump conditional on the answer
    # still being ungraded AND still stale (is + lt filters).
    claims = [
        u for u in fake.updates
        if u["table"] == "questions" and "answered_at" in u["payload"]
    ]
    assert len(claims) == 1
    claim_ops = {f[0] for f in claims[0]["filters"]}
    assert "is" in claim_ops and "lt" in claim_ops

    # Attempt counter persisted inside eval_result jsonb.
    attempt_writes = [
        u for u in fake.updates
        if (u["payload"].get("eval_result") or {}).get("attempts") == 1
    ]
    assert attempt_writes, "heal must record the attempt in eval_result"

    # Re-drive spawned off-thread; nothing ran the LLM inline.
    spawn_mock.assert_called_once()
    assert spawn_mock.call_args.args == (
        session_manager.evaluate_answer_bg, SESSION_ID, USER_ID, QUESTION_ID,
    )
    llm_mock.assert_not_called()


def test_stale_heal_claim_lost_does_not_redrive():
    """If the conditional claim matches zero rows (another worker claimed this
    TTL window, or the verdict just landed) the heal must do nothing more."""
    stale = datetime.now(timezone.utc) - timedelta(seconds=120)

    def lose_claims(table, filters, payload):
        if table == "questions" and "answered_at" in payload:
            return []  # claim lost
        return None

    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(user_answer="a", is_correct=None, answered_at=stale)],
        update_hook=lose_claims,
    )
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "_spawn_bg") as spawn_mock:
        result = session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)

    assert result["eval_status"] == "pending"
    spawn_mock.assert_not_called()
    # No attempts bookkeeping after a lost claim.
    assert not [
        u for u in fake.updates if "eval_result" in u["payload"]
    ], "lost claim must not write attempts"


def test_stale_heal_fails_closed_after_attempt_cap():
    """Third stale claim (attempts cap) fails closed: conditional
    is_correct=false write with apology feedback, then finalize; next-question
    generation is handed to a daemon thread, never run inline."""
    stale = datetime.now(timezone.utc) - timedelta(seconds=120)
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[
            _make_question(
                user_answer="a",
                is_correct=None,
                answered_at=stale,
                eval_result={"attempts": 2},
            )
        ],
    )
    finalized = {
        "result": {"is_correct": False},
        "session_complete": False,
        "session_ended_reason": None,
    }
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "_finalize_answer", return_value=finalized) as fin_mock, \
         patch.object(session_manager, "_spawn_bg") as spawn_mock, \
         patch.object(session_manager, "evaluate_answer") as llm_mock:
        session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)

    fail_writes = [
        u for u in fake.updates
        if u["table"] == "questions" and u["payload"].get("is_correct") is False
    ]
    assert len(fail_writes) == 1
    assert ("is", "is_correct", "null") in fail_writes[0]["filters"]
    assert (
        fail_writes[0]["payload"]["eval_result"]["feedback"]
        == session_manager.EVAL_FAILED_FEEDBACK
    )
    fin_mock.assert_called_once()
    llm_mock.assert_not_called()
    spawn_mock.assert_called_once()
    assert spawn_mock.call_args.args == (
        session_manager.generate_next_question_bg, SESSION_ID, USER_ID,
    )


def test_check_answer_verdict_rejects_unanswered_question():
    """Polling the verdict of a question with no submitted answer must raise —
    never return a payload (the pending dict was an answer-leak vector)."""
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(user_answer=None)],
    )
    with patch.object(session_manager, "supabase_admin", fake):
        with pytest.raises(ValueError, match="not answered"):
            session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)


def test_pending_payloads_never_leak_correct_answer():
    """Both pending payloads — the verdict poll and the submit fast path —
    must carry neutral fields only: no correct_answer, no explanation."""
    fake = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[
            _make_question(user_answer="a", is_correct=None, answered_at=datetime.now(timezone.utc))
        ],
    )
    with patch.object(session_manager, "supabase_admin", fake):
        polled = session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)
    assert polled["eval_status"] == "pending"
    assert polled["result"]["correct_answer"] is None
    assert polled["result"]["explanation"] is None

    fake2 = _FakeSupabase(
        sessions=[_make_active_session()],
        questions=[_make_question(qtype="text_free")],
    )
    with patch.object(session_manager, "supabase_admin", fake2), \
         patch.object(session_manager, "evaluate_answer"):
        submitted = session_manager.submit_answer(
            SESSION_ID, USER_ID, QUESTION_ID, "ans", "typed"
        )
    assert submitted["eval_status"] == "pending"
    assert submitted["result"]["correct_answer"] is None
    assert submitted["result"]["explanation"] is None


def test_verdict_returns_stored_feedback_and_mastery_delta():
    """A graded verdict surfaces the persisted eval_result (feedback, real
    mastery_delta, xp) instead of hardcoded None/0.0."""
    session = _make_active_session(total=5, answered=2, correct=2)
    fake = _FakeSupabase(
        sessions=[session],
        questions=[
            _make_question(
                user_answer="a",
                is_correct=True,
                answered_at=datetime.now(timezone.utc),
                eval_result={"feedback": "nice work", "mastery_delta": 3.5, "xp_awarded": 10},
            )
        ],
    )
    with patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)

    assert result["eval_status"] == "complete"
    assert result["result"]["feedback"] == "nice work"
    assert result["result"]["mastery_delta"] == 3.5
    assert result["result"]["xp_awarded"] == 10
    # Session row already reflects the finalize → its counters are used.
    assert result["result"]["score_so_far"] == 2
    assert result["result"]["total_answered"] == 2


def test_verdict_midflight_derives_counts_from_question_rows():
    """Verdict written but finalize not yet reflected in the session row
    (answered_questions < question_number): the poller must derive counts from
    the question rows and completion from the graded count — never report a
    graded final answer with session_complete=False."""
    session = _make_active_session(total=2, answered=1, correct=1)  # stale counters
    q1 = _make_question(
        qid="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        question_number=1,
        user_answer="x",
        is_correct=True,
    )
    q2 = _make_question(user_answer="a", is_correct=True, question_number=2)
    fake = _FakeSupabase(sessions=[session], questions=[q1, q2])
    with patch.object(session_manager, "supabase_admin", fake):
        result = session_manager.check_answer_verdict(SESSION_ID, USER_ID, QUESTION_ID)

    assert result["eval_status"] == "complete"
    assert result["result"]["total_answered"] == 2
    assert result["result"]["score_so_far"] == 2
    assert result["session_complete"] is True
    assert result["session_ended_reason"] == "cap_reached"


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


# ---------------------------------------------------------------------------
# _select_next_concept — wrong-answer bias boost (issue #24)
# ---------------------------------------------------------------------------

CORE_A = "11111111-1111-1111-1111-111111111111"
CORE_B = "22222222-2222-2222-2222-222222222222"
CORE_C = "33333333-3333-3333-3333-333333333333"
CORE_F = "44444444-4444-4444-4444-444444444444"


def _concept(cid: str, importance: float, mastery: float, is_core: bool = True) -> dict:
    return {
        "id": cid,
        "concept_name": f"Concept-{cid[:4]}",
        "importance_score": importance,
        "is_core": is_core,
        "mastery_score": mastery,
    }


def _hist(records: list[dict]) -> list[dict]:
    """Build a session question history (oldest first) with sane defaults."""
    out = []
    for i, r in enumerate(records, start=1):
        out.append(
            {
                "id": f"q-{i}",
                "concept_ids": r["concept_ids"],
                "is_correct": r["is_correct"],
                "user_answer": "x",
                "answered_at": f"2026-05-04T00:00:{i:02d}+00:00",
                "question_number": i,
            }
        )
    return out


def _run_picks(concepts: list[dict], history: list[dict], seed: int, n: int = 600) -> list[str]:
    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_get_session_question_history", return_value=history):
        random.seed(seed)
        return [
            session_manager._select_next_concept(SESSION_ID, USER_ID, DOC_ID)["id"]
            for _ in range(n)
        ]


def test_recently_missed_concept_selected_more_often():
    """A concept missed in the last 10 answered Qs outdraws an equally-mastered
    non-missed peer. Same-seed control isolates the ×1.3 boost as the cause."""
    concepts = [
        _concept(CORE_A, importance=1.0, mastery=50.0),
        _concept(CORE_B, importance=1.0, mastery=50.0),
        _concept(CORE_C, importance=1.0, mastery=95.0),  # filler → skip/dedup-excluded
    ]
    # Last 3 = C,C,C → dedup excludes C (and 3-correct lockout). Candidates = A,B.
    # A's miss sits inside the last-10 window but outside the last-3 dedup window.
    missed = _hist([
        {"concept_ids": [CORE_A], "is_correct": False},
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
    ])
    control = _hist([
        {"concept_ids": [CORE_A], "is_correct": True},  # A answered correctly → no boost
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
    ])

    missed_picks = _run_picks(concepts, missed, seed=0)
    control_picks = _run_picks(concepts, control, seed=0)

    a_missed = missed_picks.count(CORE_A)
    b_missed = missed_picks.count(CORE_B)
    a_control = control_picks.count(CORE_A)

    # The boosted concept beats its equally-mastered peer...
    assert a_missed > b_missed
    # ...and beats its own non-missed baseline under an identical RNG stream.
    assert a_missed > a_control


def test_wrong_answer_boost_never_overrides_recent_dedup():
    """Even a tempting, recently-missed concept stays excluded while it sits in
    the RECENT_ASK_WINDOW — dedup wins over the boost."""
    concepts = [
        _concept(CORE_A, importance=1.0, mastery=10.0),  # very tempting + missed
        _concept(CORE_B, importance=1.0, mastery=50.0),
        _concept(CORE_C, importance=1.0, mastery=50.0),
    ]
    # A fills the last 3 answered Qs (and was missed) → dedup-excluded despite boost.
    history = _hist([
        {"concept_ids": [CORE_A], "is_correct": False},
        {"concept_ids": [CORE_A], "is_correct": False},
        {"concept_ids": [CORE_A], "is_correct": False},
    ])
    picks = _run_picks(concepts, history, seed=0, n=200)
    assert CORE_A not in picks, "recently-asked concept must stay excluded even when missed"
    assert all(p in {CORE_B, CORE_C} for p in picks)


def test_miss_outside_window_is_not_boosted():
    """A miss older than WRONG_ANSWER_WINDOW answered Qs no longer boosts."""
    concepts = [
        _concept(CORE_A, importance=1.0, mastery=50.0),
        _concept(CORE_B, importance=1.0, mastery=50.0),
        _concept(CORE_C, importance=1.0, mastery=95.0),
        _concept(CORE_F, importance=1.0, mastery=95.0),
    ]
    # A missed at position -10 (inside the 10-Q window).
    inside = _hist([
        {"concept_ids": [CORE_F], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": False},
        *[{"concept_ids": [CORE_F], "is_correct": True} for _ in range(6)],
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
    ])
    # Same history but A's miss shifted to position -11 (outside the window).
    outside = _hist([
        {"concept_ids": [CORE_A], "is_correct": False},
        *[{"concept_ids": [CORE_F], "is_correct": True} for _ in range(7)],
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
    ])

    a_inside = _run_picks(concepts, inside, seed=0).count(CORE_A)
    a_outside = _run_picks(concepts, outside, seed=0).count(CORE_A)

    # Under an identical RNG stream, the in-window miss is boosted and the
    # out-of-window miss is not, so the in-window run picks A strictly more.
    assert a_inside > a_outside


def test_pending_eval_rows_do_not_break_trailing_correct_lockout():
    """An is_correct=None row (async eval in flight, #22) is neutral: it must
    not clear an earned 3-correct lockout. Pre-fix, the backward walk treated
    None as wrong, froze the concept, and made it selectable again."""
    concepts = [
        _concept(CORE_A, importance=1.0, mastery=50.0),
        _concept(CORE_B, importance=1.0, mastery=50.0),
        _concept(CORE_C, importance=1.0, mastery=50.0),
        _concept(CORE_F, importance=1.0, mastery=50.0),
    ]
    # C earns the 3-correct lockout, then gets asked again with the verdict
    # still pending; A/B/F fill the recent-ask window so a broken lockout
    # would leave C as the ONLY candidate.
    history = _hist([
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": None},  # pending async eval
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_F], "is_correct": True},
    ])
    picks = _run_picks(concepts, history, seed=0, n=200)
    assert CORE_C not in picks, "pending row must not clear the 3-correct lockout"


def test_pending_eval_rows_are_not_boosted_as_misses():
    """An is_correct=None row is not a miss: under an identical RNG stream the
    selection sequence must be exactly the same whether A's trailing answer is
    still pending or was correct — no ×1.3 boost, no lockout side effects."""
    concepts = [
        _concept(CORE_A, importance=1.0, mastery=50.0),
        _concept(CORE_B, importance=1.0, mastery=50.0),
        _concept(CORE_C, importance=1.0, mastery=95.0),
    ]
    pending = _hist([
        {"concept_ids": [CORE_A], "is_correct": None},  # awaiting verdict
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
    ])
    control = _hist([
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
        {"concept_ids": [CORE_C], "is_correct": True},
    ])
    assert _run_picks(concepts, pending, seed=0) == _run_picks(concepts, control, seed=0)


# ---------------------------------------------------------------------------
# Semantic question dedup (#23)
# ---------------------------------------------------------------------------

DIM = 1536
_IDENT = [1.0] * DIM
_DISTINCT = [0.0] * (DIM - 1) + [1.0]  # cosine ~0.026 vs _IDENT → well under threshold
_CONCEPT = {"id": CONCEPT_ID, "concept_name": "Storage engines"}


def _q_with_embedding(qid: str, question_number: int, embedding) -> dict:
    q = _make_question(qid=qid, question_number=question_number)
    q["question_embedding"] = embedding
    return q


def test_cosine_similarity_edge_cases():
    assert session_manager._cosine_similarity(_IDENT, _IDENT) == pytest.approx(1.0)
    assert session_manager._cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)  # orthogonal
    assert session_manager._cosine_similarity([1.0, 2.0, 3.0], [2.0, 4.0, 6.0]) == pytest.approx(1.0)  # parallel
    # empty / mismatched-length / zero-norm never raise → 0.0
    assert session_manager._cosine_similarity([], _IDENT) == 0.0
    assert session_manager._cosine_similarity([1.0, 2.0], [1.0]) == 0.0
    assert session_manager._cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_is_semantically_duplicate_flags_near_identical():
    """A candidate whose embedding matches a recent question's stored embedding
    (cosine > 0.85) is flagged as a duplicate."""
    prior = _q_with_embedding("prev", question_number=1, embedding=_IDENT)
    fake = _FakeSupabase(sessions=[_make_active_session()], questions=[prior])
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "get_embeddings", return_value=[_IDENT]):
        assert session_manager._is_semantically_duplicate("near dup", SESSION_ID) is True


def test_is_semantically_duplicate_passes_distinct_question():
    """A candidate far from the prior (cosine well under threshold) is NOT a
    duplicate."""
    prior = _q_with_embedding("prev", question_number=1, embedding=_IDENT)
    fake = _FakeSupabase(sessions=[_make_active_session()], questions=[prior])
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "get_embeddings", return_value=[_DISTINCT]):
        assert session_manager._is_semantically_duplicate("distinct", SESSION_ID) is False


def test_is_semantically_duplicate_fails_open_when_embedding_unavailable():
    """If the candidate can't be embedded, dedup must fail OPEN (False) so it
    never blocks question delivery — even when a matching prior exists."""
    prior = _q_with_embedding("prev", question_number=1, embedding=_IDENT)
    fake = _FakeSupabase(sessions=[_make_active_session()], questions=[prior])
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "get_embeddings", return_value=[]):
        assert session_manager._is_semantically_duplicate("q", SESSION_ID) is False


def test_is_semantically_duplicate_ignores_rows_without_embedding():
    """Rows with a NULL embedding (e.g. an in-flight 'generating' placeholder or
    pre-#23 questions) are skipped, not treated as a zero-vector match."""
    no_emb = _make_question(qid="placeholder", question_number=2)  # no question_embedding
    fake = _FakeSupabase(sessions=[_make_active_session()], questions=[no_emb])
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "get_embeddings", return_value=[_IDENT]):
        assert session_manager._is_semantically_duplicate("q", SESSION_ID) is False


def test_is_semantically_duplicate_only_checks_recent_window():
    """Only the last SEMANTIC_DEDUP_WINDOW questions are compared: a duplicate
    that has scrolled out of the window no longer trips dedup."""
    # Oldest (out-of-window) question is identical to the candidate; the 3 most
    # recent are all distinct from it.
    old_dup = _q_with_embedding("old", question_number=1, embedding=_IDENT)
    recent = [
        _q_with_embedding(f"q{n}", question_number=n, embedding=_DISTINCT)
        for n in (2, 3, 4)
    ]
    fake = _FakeSupabase(
        sessions=[_make_active_session()], questions=[old_dup, *recent]
    )
    assert session_manager.SEMANTIC_DEDUP_WINDOW == 3
    with patch.object(session_manager, "supabase_admin", fake), \
         patch.object(session_manager, "get_embeddings", return_value=[_IDENT]):
        assert session_manager._is_semantically_duplicate("q", SESSION_ID) is False


# --- generator retry (integration: consecutive Qs are not near-duplicates) ---


def test_generate_single_question_retries_on_semantic_duplicate():
    """The generator regenerates ONCE when the first question is a near-dup, and
    serves the fresh (non-duplicate) question — so consecutive session questions
    are not near-duplicates."""
    dup = {"question_text": "What is a B-tree?", "question_type": "text_free", "correct_answer": "a"}
    fresh = {"question_text": "Explain LSM trees.", "question_type": "text_free", "correct_answer": "b"}
    with patch.object(quiz_generator, "generate_quiz_questions", side_effect=[[dup], [fresh]]) as gen_mock, \
         patch.object(session_manager, "_is_semantically_duplicate", side_effect=[True, False]) as dup_mock:
        result = quiz_generator.generate_single_question(
            DOC_ID, _CONCEPT, session_id=SESSION_ID
        )

    assert result["question_text"] == "Explain LSM trees."
    assert gen_mock.call_count == 2  # initial + exactly one retry
    assert dup_mock.call_count == 2  # checked the first, then the retry


def test_generate_single_question_no_retry_when_unique():
    """A first-shot non-duplicate is served immediately — no wasted regeneration."""
    fresh = {"question_text": "Explain LSM trees.", "question_type": "text_free", "correct_answer": "b"}
    with patch.object(quiz_generator, "generate_quiz_questions", side_effect=[[fresh]]) as gen_mock, \
         patch.object(session_manager, "_is_semantically_duplicate", return_value=False) as dup_mock:
        result = quiz_generator.generate_single_question(
            DOC_ID, _CONCEPT, session_id=SESSION_ID
        )

    assert result["question_text"] == "Explain LSM trees."
    assert gen_mock.call_count == 1
    dup_mock.assert_called_once()


def test_generate_single_question_falls_through_when_retry_still_duplicate():
    """At most ONE retry: if the retry is also a duplicate, fall through
    gracefully with the first question — dedup must never return None."""
    dup1 = {"question_text": "What is a B-tree?", "question_type": "text_free", "correct_answer": "a"}
    dup2 = {"question_text": "Define a B-tree.", "question_type": "text_free", "correct_answer": "a"}
    with patch.object(quiz_generator, "generate_quiz_questions", side_effect=[[dup1], [dup2]]) as gen_mock, \
         patch.object(session_manager, "_is_semantically_duplicate", return_value=True):
        result = quiz_generator.generate_single_question(
            DOC_ID, _CONCEPT, session_id=SESSION_ID
        )

    assert result is not None
    assert result["question_text"] == "What is a B-tree?"  # kept the first
    assert gen_mock.call_count == 2  # never more than one retry


def test_generate_single_question_skips_dedup_without_session_id():
    """No session_id → dedup is skipped entirely (legacy one-shot callers)."""
    fresh = {"question_text": "Explain LSM trees.", "question_type": "text_free", "correct_answer": "b"}
    with patch.object(quiz_generator, "generate_quiz_questions", side_effect=[[fresh]]) as gen_mock, \
         patch.object(session_manager, "_is_semantically_duplicate") as dup_mock:
        result = quiz_generator.generate_single_question(DOC_ID, _CONCEPT)

    dup_mock.assert_not_called()
    assert gen_mock.call_count == 1
    assert result["question_text"] == "Explain LSM trees."
