"""MCQ grading accepts bare option text (#61).

`normalize_mcq_answer` only ever resolved letters and `A) …` forms, so a
client that submitted the option's *text* was silently graded wrong. These
tests pin the new behaviour and, just as importantly, pin that callers who
pass no option list still get exactly the old letter-only grading.
"""

from __future__ import annotations

import pytest

from app.services.answer_evaluator import evaluate_answer, evaluate_mcq

OPTIONS = [
    "A) Sharding splits rows across nodes",
    "B) Replication copies rows to nodes",
    "C) Indexing sorts rows on disk",
    "D) Partitioning is a synonym for caching",
]


# ---------------------------------------------------------------------------
# The headline: letter, decorated letter and option text grade identically.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "submission",
    [
        "A",
        "a",
        "a)",
        "A) Sharding splits rows across nodes",
        "Sharding splits rows across nodes",
        "sharding splits rows across nodes",
        "  Sharding   splits rows   across nodes  ",
    ],
)
def test_every_spelling_of_the_right_answer_grades_correct(submission):
    is_correct, _feedback = evaluate_mcq(submission, "A", OPTIONS)
    assert is_correct is True


@pytest.mark.parametrize(
    "submission",
    [
        "B",
        "b)",
        "Replication copies rows to nodes",
        "B) Replication copies rows to nodes",
    ],
)
def test_every_spelling_of_a_wrong_answer_grades_incorrect(submission):
    is_correct, _feedback = evaluate_mcq(submission, "A", OPTIONS)
    assert is_correct is False


def test_unknown_text_still_grades_wrong():
    is_correct, _feedback = evaluate_mcq("something else entirely", "A", OPTIONS)
    assert is_correct is False


def test_empty_answer_grades_wrong():
    assert evaluate_mcq("", "A", OPTIONS)[0] is False
    assert evaluate_mcq("   ", "A", OPTIONS)[0] is False


# ---------------------------------------------------------------------------
# `options` is optional — existing callers must be untouched.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("user_answer", "correct", "expected"),
    [
        ("A", "A", True),
        ("a", "A", True),
        ("A)", "A", True),
        ("A. text", "A", True),
        ("B", "A", False),
        ("Sharding splits rows across nodes", "A", False),  # no options to match
    ],
)
def test_letter_only_behaviour_without_options(user_answer, correct, expected):
    assert evaluate_mcq(user_answer, correct)[0] is expected


def test_evaluate_mcq_is_still_callable_positionally_with_two_args():
    """The pre-#61 signature must keep working verbatim."""
    assert evaluate_mcq("A", "A")[0] is True


# ---------------------------------------------------------------------------
# Correct answers stored as text rather than a letter.
# ---------------------------------------------------------------------------


def test_correct_answer_stored_as_option_text_matches_a_letter_submission():
    is_correct, _feedback = evaluate_mcq(
        "A", "Sharding splits rows across nodes", OPTIONS
    )
    assert is_correct is True


def test_correct_answer_stored_as_option_text_matches_text_submission():
    is_correct, _feedback = evaluate_mcq(
        "Sharding splits rows across nodes",
        "A) Sharding splits rows across nodes",
        OPTIONS,
    )
    assert is_correct is True


# ---------------------------------------------------------------------------
# Label stripping must not eat real words.
# ---------------------------------------------------------------------------


def test_option_beginning_with_a_bare_letter_word_is_not_mangled():
    """"A device that ..." must match in full, not as "device that ..."."""
    options = ["A device that stores rows", "B) Something else"]
    assert evaluate_mcq("A device that stores rows", "A", options)[0] is True
    assert evaluate_mcq("device that stores rows", "A", options)[0] is False


def test_unlabelled_options_still_match():
    options = ["Sharding", "Replication", "Indexing", "Partitioning"]
    assert evaluate_mcq("Replication", "B", options)[0] is True
    assert evaluate_mcq("Replication", "A", options)[0] is False


@pytest.mark.parametrize("label", ["A)", "A.", "A:"])
def test_supported_label_delimiters(label):
    options = [f"{label} Sharding", "B) Replication"]
    assert evaluate_mcq("Sharding", "A", options)[0] is True


# ---------------------------------------------------------------------------
# Malformed option payloads must not raise.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("bad_options", [None, [], "A) not a list", {"a": "b"}, 42])
def test_malformed_options_degrade_to_letter_matching(bad_options):
    assert evaluate_mcq("A", "A", bad_options)[0] is True
    assert evaluate_mcq("B", "A", bad_options)[0] is False


def test_more_options_than_letters_does_not_raise():
    options = OPTIONS + ["E) Extra", "F) Extra"]
    assert evaluate_mcq("Extra", "A", options)[0] is False


# ---------------------------------------------------------------------------
# The routing layer threads options through.
# ---------------------------------------------------------------------------


def test_evaluate_answer_threads_options_to_the_mcq_branch():
    result = evaluate_answer(
        question_type="text_mcq",
        user_answer="Sharding splits rows across nodes",
        correct_answer="A",
        options=OPTIONS,
    )
    assert result["is_correct"] is True


def test_evaluate_answer_without_options_is_unchanged():
    result = evaluate_answer(
        question_type="text_mcq",
        user_answer="Sharding splits rows across nodes",
        correct_answer="A",
    )
    assert result["is_correct"] is False


def test_evaluate_answer_ignores_options_for_true_false():
    result = evaluate_answer(
        question_type="text_tf",
        user_answer="true",
        correct_answer="true",
        options=OPTIONS,
    )
    assert result["is_correct"] is True
