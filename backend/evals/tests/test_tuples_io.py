"""Unit tests for evals.tuples_io — tuple parsing + validation.

All fixtures/data here are SYNTHETIC and test-only.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pytest

from evals.tuples_io import TupleError, load_tuples, validate_tuple

_VALID = {
    "question": "TEST FIXTURE: q?",
    "source_chunk_text": "TEST FIXTURE: source.",
    "ideal_answer": "TEST FIXTURE: answer.",
    "concept_label": "t",
}

_PATH = Path("evals/golden/ddia.jsonl")


# --- validate_tuple ---

def test_valid_tuple_ok():
    row = validate_tuple(dict(_VALID), doc="ddia", path=_PATH, lineno=1)
    assert row["question"] == _VALID["question"]
    assert row["source_chunk_text"]


def test_source_chunk_alias_normalized():
    row = {"question": "TEST FIXTURE: q", "source_chunk": "TEST FIXTURE: src",
           "ideal_answer": "TEST FIXTURE: a"}
    out = validate_tuple(row, doc="ddia", path=_PATH, lineno=2)
    assert "source_chunk_text" in out and "source_chunk" not in out
    assert out["source_chunk_text"] == "TEST FIXTURE: src"


def test_missing_required_field_raises():
    for field in ("question", "ideal_answer", "source_chunk_text"):
        bad = dict(_VALID)
        bad.pop(field)
        with pytest.raises(TupleError) as exc:
            validate_tuple(bad, doc="ddia", path=_PATH, lineno=3)
        assert field in str(exc.value)


def test_empty_field_raises():
    bad = dict(_VALID)
    bad["ideal_answer"] = "   "
    with pytest.raises(TupleError):
        validate_tuple(bad, doc="ddia", path=_PATH, lineno=4)


def test_non_string_field_raises():
    bad = dict(_VALID)
    bad["question"] = 42
    with pytest.raises(TupleError):
        validate_tuple(bad, doc="ddia", path=_PATH, lineno=5)


def test_non_object_tuple_raises():
    with pytest.raises(TupleError):
        validate_tuple(["not", "an", "object"], doc="ddia", path=_PATH, lineno=6)


@pytest.mark.parametrize("text", [
    "<paste the question here>",
    "<fill source chunk>",
    "TODO: write ideal answer",
    "REPLACE_WITH_ANSWER",
    "FILL_ME ideal",
])
def test_placeholder_text_raises(text):
    bad = dict(_VALID)
    bad["ideal_answer"] = text
    with pytest.raises(TupleError) as exc:
        validate_tuple(bad, doc="ddia", path=_PATH, lineno=7)
    assert "placeholder" in str(exc.value).lower()


def test_unknown_field_warns(caplog):
    row = dict(_VALID)
    row["extra"] = "x"
    with caplog.at_level(logging.WARNING):
        out = validate_tuple(row, doc="ddia", path=_PATH, lineno=8)
    assert out["question"] == _VALID["question"]
    assert any("extra" in r.message for r in caplog.records)


# --- load_tuples: file integration ---

def test_load_tuples_valid_with_limit(fixtures_dir: Path):
    rows = load_tuples("ddia_valid", limit=2, golden_dir=fixtures_dir)
    assert len(rows) == 2
    assert all("question" in r for r in rows)


def test_load_tuples_all_rows(fixtures_dir: Path):
    rows = load_tuples("ddia_valid", golden_dir=fixtures_dir)
    assert len(rows) == 3


def test_load_tuples_skips_blank_and_comment_lines(fixtures_dir: Path):
    rows = load_tuples("ddia_comments", golden_dir=fixtures_dir)
    assert len(rows) == 1


def test_load_tuples_empty_file_returns_empty(fixtures_dir: Path):
    rows = load_tuples("ddia_empty", golden_dir=fixtures_dir)
    assert rows == []


def test_load_tuples_source_chunk_alias(fixtures_dir: Path):
    rows = load_tuples("ddia_alias", golden_dir=fixtures_dir)
    assert len(rows) == 1
    assert rows[0]["source_chunk_text"] == "TEST FIXTURE: alias source"
    assert "source_chunk" not in rows[0]


def test_load_tuples_bad_json_raises(fixtures_dir: Path):
    with pytest.raises(TupleError) as exc:
        load_tuples("ddia_badjson_tuples", golden_dir=fixtures_dir)
    assert "valid JSON" in str(exc.value)


def test_load_tuples_placeholder_raises(fixtures_dir: Path):
    with pytest.raises(TupleError):
        load_tuples("ddia_placeholder_tuples", golden_dir=fixtures_dir)


def test_load_tuples_missing_file(fixtures_dir: Path):
    with pytest.raises(FileNotFoundError):
        load_tuples("nope", golden_dir=fixtures_dir)
