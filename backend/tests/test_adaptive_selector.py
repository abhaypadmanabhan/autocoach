"""Tests for the adaptive concept selector and end-on-mastery logic."""

import random
from unittest.mock import patch

import pytest

from app.services import session_manager


CORE_A = "11111111-1111-1111-1111-111111111111"
CORE_B = "22222222-2222-2222-2222-222222222222"
CORE_C = "33333333-3333-3333-3333-333333333333"

DOC_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"
USER_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
SESSION_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff"


def _concept(cid: str, importance: float, mastery: float, is_core: bool = True) -> dict:
    return {
        "id": cid,
        "concept_name": f"Concept-{cid[:4]}",
        "importance_score": importance,
        "is_core": is_core,
        "mastery_score": mastery,
    }


def _hist(question_records: list[dict]) -> list[dict]:
    """Helper to build a question history with sane defaults."""
    out = []
    for i, q in enumerate(question_records, start=1):
        out.append(
            {
                "id": f"q-{i}",
                "concept_ids": q["concept_ids"],
                "is_correct": q["is_correct"],
                "user_answer": "x",
                "answered_at": f"2026-05-04T00:00:0{i}+00:00",
                "question_number": i,
            }
        )
    return out


def test_selector_prefers_low_mastery_core_concept():
    """Without history, weighted pick should heavily favour low-mastery concepts."""
    concepts = [
        _concept(CORE_A, importance=1.0, mastery=10.0),  # weight ≈ 90
        _concept(CORE_B, importance=1.0, mastery=70.0),  # weight ≈ 30
    ]
    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_get_session_question_history", return_value=[]):
        random.seed(0)
        picks = [
            session_manager._select_next_concept(SESSION_ID, USER_ID, DOC_ID)["id"]
            for _ in range(400)
        ]

    a_count = picks.count(CORE_A)
    # With 30% exploration over 2 concepts, expected baseline for A is ~0.7*0.75 + 0.3*0.5 = 0.675
    assert a_count > picks.count(CORE_B), "Low-mastery concept should win majority of picks"
    assert a_count / len(picks) > 0.55


def test_selector_skips_concept_after_three_consecutive_correct():
    """A concept answered correctly 3 times in a row this session is excluded."""
    concepts = [
        _concept(CORE_A, importance=1.0, mastery=20.0),
        _concept(CORE_B, importance=1.0, mastery=20.0),
    ]
    history = _hist([
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": True},
    ])

    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_get_session_question_history", return_value=history):
        random.seed(0)
        picks = [
            session_manager._select_next_concept(SESSION_ID, USER_ID, DOC_ID)["id"]
            for _ in range(50)
        ]

    assert all(p == CORE_B for p in picks), "A is locked-out after 3 trailing corrects"


def test_selector_resets_streak_on_wrong_answer():
    """A wrong answer in between resets the trailing-correct counter.

    History places the streak-relevant CORE_A activity in the older part of
    history and CORE_B in the recent window, so the recent-asked dedup filter
    (RECENT_ASK_WINDOW) does not interfere with what this test is checking.
    """
    concepts = [
        _concept(CORE_A, importance=1.0, mastery=20.0),
        _concept(CORE_B, importance=1.0, mastery=20.0),
    ]
    # A correct, A correct, A wrong, A correct, A correct, B, B, B
    # → A trailing-correct = 2 (frozen by the wrong) → not skipped
    # → A NOT in last RECENT_ASK_WINDOW (=3) entries → not dedup-filtered
    history = _hist([
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": False},
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_B], "is_correct": True},
    ])

    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_get_session_question_history", return_value=history):
        random.seed(0)
        picks = [
            session_manager._select_next_concept(SESSION_ID, USER_ID, DOC_ID)["id"]
            for _ in range(200)
        ]

    assert CORE_A in picks, "A should not be locked out — the streak was broken by a wrong answer"


def test_selector_skips_concept_asked_in_recent_window():
    """A concept asked within the last RECENT_ASK_WINDOW questions is excluded
    even if its trailing-correct count is below the lockout threshold.

    Bug fix: prior to this, the selector only deprioritized after 3 consecutive
    correct answers, so the same concept could be picked back-to-back-to-back
    (Langfuse trace 2026-05-09 showed RAG-components asked 3× in one session).
    """
    concepts = [
        _concept(CORE_A, importance=1.0, mastery=10.0),  # very tempting weight
        _concept(CORE_B, importance=1.0, mastery=70.0),
    ]
    # B in old history (out of recent window), A fills the last 3 answered Qs.
    # A must be excluded by recent_asked despite tempting weight.
    history = _hist([
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": False},
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": True},
    ])

    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_get_session_question_history", return_value=history):
        random.seed(0)
        picks = [
            session_manager._select_next_concept(SESSION_ID, USER_ID, DOC_ID)["id"]
            for _ in range(200)
        ]

    assert all(p == CORE_B for p in picks), (
        f"A was asked in the recent window and must be excluded; picks={picks[:10]}…"
    )


def test_selector_falls_back_when_all_concepts_in_recent_window():
    """Tiny core pool: if the recent-window filter would empty the candidate
    list, drop that filter (still respect 3-correct lockout) and pick anyway."""
    concepts = [
        _concept(CORE_A, importance=1.0, mastery=20.0),
        _concept(CORE_B, importance=1.0, mastery=20.0),
    ]
    # Only 2 core concepts; recent 3 history entries cover both.
    history = _hist([
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": True},
    ])

    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_get_session_question_history", return_value=history):
        random.seed(0)
        result = session_manager._select_next_concept(SESSION_ID, USER_ID, DOC_ID)

    assert result is not None
    assert result["id"] in {CORE_A, CORE_B}


def test_all_core_mastered_helper():
    mastered = [
        _concept(CORE_A, 1.0, 80.0),
        _concept(CORE_B, 1.0, 95.0),
        _concept(CORE_C, 1.0, 40.0, is_core=False),  # advanced — ignored
    ]
    not_yet = [
        _concept(CORE_A, 1.0, 80.0),
        _concept(CORE_B, 1.0, 79.99),
    ]
    no_core = [_concept(CORE_A, 1.0, 100.0, is_core=False)]

    assert session_manager._all_core_mastered(mastered) is True
    assert session_manager._all_core_mastered(not_yet) is False
    assert session_manager._all_core_mastered(no_core) is False
    assert session_manager._all_core_mastered([]) is False


def test_selector_returns_none_when_no_core_concepts():
    """Edge case: a document with only advanced concepts cannot be selected for."""
    concepts = [_concept(CORE_A, 1.0, 50.0, is_core=False)]
    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_get_session_question_history", return_value=[]):
        result = session_manager._select_next_concept(SESSION_ID, USER_ID, DOC_ID)
    assert result is None


def test_selector_falls_back_when_all_concepts_deprioritized():
    """If every core concept has 3 trailing correct, fall back to full core list
    rather than returning None — better to repeat than to dead-end."""
    concepts = [
        _concept(CORE_A, 1.0, 50.0),
        _concept(CORE_B, 1.0, 50.0),
    ]
    history = _hist([
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_A], "is_correct": True},
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_B], "is_correct": True},
        {"concept_ids": [CORE_B], "is_correct": True},
    ])
    with patch.object(session_manager, "get_document_concepts", return_value=concepts), \
         patch.object(session_manager, "_get_session_question_history", return_value=history):
        random.seed(7)
        result = session_manager._select_next_concept(SESSION_ID, USER_ID, DOC_ID)
    assert result is not None
    assert result["id"] in {CORE_A, CORE_B}
