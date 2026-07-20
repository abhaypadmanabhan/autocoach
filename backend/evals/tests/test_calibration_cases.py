"""Tests for the balanced calibration case set and its materialisation.

Hermetic: no API key, no network, no Qdrant. Materialisation reads gitignored
baseline CSVs, so tests build their own fixture CSVs rather than depending on
whatever happens to be on the developer's disk.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

from evals import calibration_cases as cc
from evals.calibration_cases import (
    CASES_PATH,
    CaseError,
    FAITHFUL,
    MUTATION_TYPES,
    NON_RESPONSIVE,
    PARTIALLY_RESPONSIVE,
    RESPONSIVE,
    UNFAITHFUL,
    apply_mutation,
    distribution,
    load_cases,
    materialise_cases,
    split_sentences,
    text_sha,
)

# Stand-ins for source-derived text. If any of these reach a committed file the
# leakage tests fail.
FIXTURE_ANSWER = (
    "Alpha keeps a signpost on the side. Beta follows the chain because gamma holds. "
    "The cluster has 10,000 disks and lasts 10 to 50 years."
)
FIXTURE_QUESTION = "What does alpha keep?"
FIXTURE_CONTEXT = "FIXTURE-CONTEXT-BODY-MUST-NOT-BE-COMMITTED"


def _write_baseline(path: Path, rows: dict[int, tuple[str, str]]) -> Path:
    """rows: {row_index: (question, answer)}"""
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        "row_index", "doc", "document_label", "question", "answer", "reference",
        "concept_label", "context_count", "retrieval_hit_at_k",
        "context_precision", "context_recall", "faithfulness", "answer_relevancy",
        "retrieved_contexts",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for index, (question, answer) in rows.items():
            writer.writerow({
                "row_index": index, "doc": "ddia", "document_label": "DDIA",
                "question": question, "answer": answer, "reference": f"ideal {index}",
                "concept_label": f"concept {index}", "context_count": 2,
                "retrieval_hit_at_k": True, "context_precision": 1.0,
                "context_recall": 1.0, "faithfulness": 1.0, "answer_relevancy": 0.9,
                "retrieved_contexts": repr([f"{FIXTURE_CONTEXT} a", f"{FIXTURE_CONTEXT} b"]),
            })
    return path


@pytest.fixture
def baseline_dir(tmp_path: Path) -> Path:
    directory = tmp_path / "results"
    _write_baseline(directory / "ddia_20260711T044804Z.csv", {
        1: (FIXTURE_QUESTION, FIXTURE_ANSWER),
        2: ("What does beta follow?", "Beta follows the chain. It does so reliably."),
    })
    return directory


def _case_dict(**overrides):
    base = {
        "case_id": 1, "doc": "ddia", "source_row": 1, "mutation": "identity",
        "params": {}, "expected_faithfulness": FAITHFUL,
        "expected_quality": RESPONSIVE, "rationale": "unchanged control",
        "question_sha": text_sha(FIXTURE_QUESTION), "answer_sha": text_sha(FIXTURE_ANSWER),
    }
    base.update(overrides)
    return base


def _write_cases(path: Path, cases: list[dict], *, version: int = cc.SCHEMA_VERSION) -> Path:
    path.write_text(json.dumps({"schema_version": version, "cases": cases}, indent=2))
    return path


# --------------------------------------------------------------------------
# 1. Positive AND negative examples both present
# --------------------------------------------------------------------------


def test_shipped_set_contains_both_positive_and_negative_faithfulness():
    """The whole point of this set: a lenient judge must be detectable."""
    cases = load_cases()
    counts = distribution(cases)["faithfulness"]
    assert counts.get(FAITHFUL, 0) >= 6, "no positive examples"
    assert counts.get(UNFAITHFUL, 0) >= 6, "no negative examples — cannot detect leniency"


def test_shipped_set_is_balanced():
    counts = distribution(load_cases())["faithfulness"]
    assert counts == {FAITHFUL: 12, UNFAITHFUL: 12}


def test_mutation_polarities_match_their_semantic_contracts():
    faithful_mutations = {"identity", "drop_sentence", "evade_request", "swap_question"}
    unfaithful_mutations = {
        "append_claim", "combine", "replace_number", "reverse_causal", "fabricate",
    }
    for case in load_cases():
        if case.mutation in faithful_mutations:
            assert case.expected_faithfulness == FAITHFUL, case.key
        elif case.mutation in unfaithful_mutations:
            assert case.expected_faithfulness == UNFAITHFUL, case.key
        else:  # protects the contract when a mutation is added to the shipped set
            pytest.fail(f"mutation {case.mutation!r} has no polarity contract")


def test_shipped_set_covers_all_three_quality_labels():
    counts = distribution(load_cases())["quality"]
    for label in (RESPONSIVE, PARTIALLY_RESPONSIVE, NON_RESPONSIVE):
        assert counts.get(label, 0) > 0, f"no {label} cases"


def test_shipped_set_meets_the_required_distribution():
    cases = load_cases()
    assert len(cases) >= 24
    counts = distribution(cases)
    assert counts["quality"][PARTIALLY_RESPONSIVE] >= 3
    assert counts["quality"][NON_RESPONSIVE] >= 3
    assert counts["mutation"]["identity"] >= 6


def test_shipped_set_spans_multiple_documents_and_concepts():
    cases = load_cases()
    assert len({c.doc for c in cases}) >= 3
    assert len({c.concept_label for c in cases}) >= 12


# --------------------------------------------------------------------------
# 2. Every required mutation category represented
# --------------------------------------------------------------------------


REQUIRED_MUTATIONS = (
    "append_claim",      # add one unsupported claim
    "replace_number",    # replace a correct number or entity
    "reverse_causal",    # reverse a causal relationship
    "drop_sentence",     # remove one required part
    "swap_question",     # answer a neighbouring question
    "combine",           # one supported + one unsupported statement
    "evade_request",     # preserve facts but avoid answering
)


@pytest.mark.parametrize("mutation", REQUIRED_MUTATIONS)
def test_required_mutation_category_is_present(mutation):
    assert distribution(load_cases())["mutation"].get(mutation, 0) > 0


def test_every_used_mutation_is_in_the_declared_vocabulary():
    for case in load_cases():
        assert case.mutation in MUTATION_TYPES


def test_negative_cases_never_use_identity():
    """An unchanged answer cannot be a negative example."""
    for case in load_cases():
        if case.mutation == "identity":
            assert case.expected_faithfulness == FAITHFUL


# --------------------------------------------------------------------------
# 3. Materialisation is deterministic
# --------------------------------------------------------------------------


def test_materialisation_is_deterministic(baseline_dir, tmp_path):
    path = _write_cases(tmp_path / "cases.json", [
        _case_dict(case_id=1, mutation="identity"),
        _case_dict(case_id=2, mutation="append_claim", params={"text": "Invented claim."},
                   expected_faithfulness=UNFAITHFUL),
        _case_dict(case_id=3, mutation="replace_number",
                   params={"occurrence": 1, "replacement": "42"},
                   expected_faithfulness=UNFAITHFUL),
    ])
    cases = load_cases(path)
    first = [m.row.answer for m in materialise_cases(cases, baseline_dir=baseline_dir)]
    second = [m.row.answer for m in materialise_cases(cases, baseline_dir=baseline_dir)]
    assert first == second


def test_shipped_cases_materialise_deterministically_when_baselines_present():
    """Skips cleanly on a fresh clone, which has no gitignored baselines."""
    baseline_dir = Path(cc.RESULTS_DIR)
    if not list(baseline_dir.glob("*.csv")):
        pytest.skip("no local baseline CSVs (expected on a fresh clone)")
    cases = load_cases()
    first = [m.row.answer for m in materialise_cases(cases, baseline_dir=baseline_dir)]
    second = [m.row.answer for m in materialise_cases(cases, baseline_dir=baseline_dir)]
    assert first == second
    assert len(first) == len(cases)


def test_case_id_becomes_the_scoring_row_index(baseline_dir, tmp_path):
    """Two cases off one source row must not collide in aggregation."""
    path = _write_cases(tmp_path / "cases.json", [
        _case_dict(case_id=11, mutation="identity"),
        _case_dict(case_id=12, mutation="append_claim", params={"text": "Invented."},
                   expected_faithfulness=UNFAITHFUL),
    ])
    rows = [m.as_scoring_row() for m in materialise_cases(load_cases(path), baseline_dir=baseline_dir)]
    assert [r.row_index for r in rows] == [11, 12]
    assert rows[0].answer != rows[1].answer


# --- individual mutation behaviour -----------------------------------------


def test_append_claim_keeps_the_original_and_adds_one_claim():
    obj = cc.CalibrationCase(
        case_id=1, doc="ddia", source_row=1, mutation="append_claim",
        params={"text": "Invented claim."}, expected_faithfulness=UNFAITHFUL,
        expected_quality=RESPONSIVE, rationale="r", question_sha="x", answer_sha="y",
    )
    out = apply_mutation(obj, "First sentence. Second sentence.")
    assert out == "First sentence. Second sentence. Invented claim."


def test_replace_number_targets_the_requested_occurrence():
    obj = cc.CalibrationCase(
        case_id=1, doc="d", source_row=1, mutation="replace_number",
        params={"occurrence": 3, "replacement": "500"}, expected_faithfulness=UNFAITHFUL,
        expected_quality=RESPONSIVE, rationale="r", question_sha="x", answer_sha="y",
    )
    # tokens are 10,000 / 10 / 50 — comma-grouped numbers count as one token
    out = apply_mutation(obj, "A cluster of 10,000 disks lasting 10 to 50 years.")
    assert out == "A cluster of 10,000 disks lasting 10 to 500 years."


def test_replace_number_out_of_range_fails_loudly():
    obj = cc.CalibrationCase(
        case_id=1, doc="d", source_row=1, mutation="replace_number",
        params={"occurrence": 9, "replacement": "1"}, expected_faithfulness=UNFAITHFUL,
        expected_quality=RESPONSIVE, rationale="r", question_sha="x", answer_sha="y",
    )
    with pytest.raises(CaseError, match="number token"):
        apply_mutation(obj, "Only one number: 5.")


def test_reverse_causal_swaps_the_clauses():
    obj = cc.CalibrationCase(
        case_id=1, doc="d", source_row=1, mutation="reverse_causal",
        params={"connective": "because"}, expected_faithfulness=UNFAITHFUL,
        expected_quality=RESPONSIVE, rationale="r", question_sha="x", answer_sha="y",
    )
    out = apply_mutation(obj, "The system halts because a node failed.")
    assert out == "A node failed because the system halts."


def test_reverse_causal_without_a_connective_fails_loudly():
    obj = cc.CalibrationCase(
        case_id=1, doc="d", source_row=1, mutation="reverse_causal",
        params={"connective": "because"}, expected_faithfulness=UNFAITHFUL,
        expected_quality=RESPONSIVE, rationale="r", question_sha="x", answer_sha="y",
    )
    with pytest.raises(CaseError, match="no 'because' clause"):
        apply_mutation(obj, "No causal connective here.")


def test_reverse_causal_with_multiple_candidate_clauses_fails_loudly():
    obj = cc.CalibrationCase(
        case_id=1, doc="d", source_row=1, mutation="reverse_causal",
        params={"connective": "because"}, expected_faithfulness=UNFAITHFUL,
        expected_quality=RESPONSIVE, rationale="r", question_sha="x", answer_sha="y",
    )
    with pytest.raises(CaseError, match="ambiguous"):
        apply_mutation(
            obj,
            "The system halts because a node failed. Recovery starts because a peer responds.",
        )


def test_drop_sentence_keeps_only_requested_indices():
    obj = cc.CalibrationCase(
        case_id=1, doc="d", source_row=1, mutation="drop_sentence",
        params={"keep": [0]}, expected_faithfulness=FAITHFUL,
        expected_quality=PARTIALLY_RESPONSIVE, rationale="r", question_sha="x", answer_sha="y",
    )
    assert apply_mutation(obj, "Keep this. Drop that.") == "Keep this."


def test_keep_index_out_of_range_fails_loudly():
    obj = cc.CalibrationCase(
        case_id=1, doc="d", source_row=1, mutation="drop_sentence",
        params={"keep": [5]}, expected_faithfulness=FAITHFUL,
        expected_quality=PARTIALLY_RESPONSIVE, rationale="r", question_sha="x", answer_sha="y",
    )
    with pytest.raises(CaseError, match="out of range"):
        apply_mutation(obj, "Only one sentence.")


def test_swap_question_moves_the_question_and_keeps_the_answer(baseline_dir, tmp_path):
    path = _write_cases(tmp_path / "cases.json", [
        _case_dict(case_id=1, mutation="swap_question", question_from_row=2,
                   question_from_sha=text_sha("What does beta follow?"),
                   expected_quality=NON_RESPONSIVE),
    ])
    (materialised,) = materialise_cases(load_cases(path), baseline_dir=baseline_dir)
    assert materialised.row.question == "What does beta follow?"
    assert materialised.row.answer == FIXTURE_ANSWER
    assert FIXTURE_CONTEXT in materialised.row.contexts[0]


# --------------------------------------------------------------------------
# 4. Missing / drifted source rows fail loudly
# --------------------------------------------------------------------------


def test_missing_source_row_fails_loudly(baseline_dir, tmp_path):
    path = _write_cases(tmp_path / "cases.json", [_case_dict(case_id=1, source_row=99)])
    with pytest.raises(CaseError):
        materialise_cases(load_cases(path), baseline_dir=baseline_dir)


def test_changed_baseline_question_fails_loudly(baseline_dir, tmp_path):
    path = _write_cases(tmp_path / "cases.json", [
        _case_dict(case_id=1, question_sha="0" * 16),
    ])
    with pytest.raises(CaseError, match="question .* changed"):
        materialise_cases(load_cases(path), baseline_dir=baseline_dir)


def test_changed_baseline_answer_fails_loudly(baseline_dir, tmp_path):
    path = _write_cases(tmp_path / "cases.json", [
        _case_dict(case_id=1, answer_sha="0" * 16),
    ])
    with pytest.raises(CaseError, match="answer .* changed"):
        materialise_cases(load_cases(path), baseline_dir=baseline_dir)


def test_missing_neighbour_question_row_fails_loudly(baseline_dir, tmp_path):
    path = _write_cases(tmp_path / "cases.json", [
        _case_dict(case_id=1, mutation="swap_question", question_from_row=99,
                   question_from_sha="0" * 16),
    ])
    with pytest.raises(CaseError):
        materialise_cases(load_cases(path), baseline_dir=baseline_dir)


def test_changed_neighbour_question_fails_loudly(baseline_dir, tmp_path):
    path = _write_cases(tmp_path / "cases.json", [
        _case_dict(
            case_id=1,
            mutation="swap_question",
            question_from_row=2,
            question_from_sha="0" * 16,
        ),
    ])
    with pytest.raises(CaseError, match="swapped question .* changed"):
        materialise_cases(load_cases(path), baseline_dir=baseline_dir)


def test_shipped_hashes_match_the_local_baselines():
    baseline_dir = Path(cc.RESULTS_DIR)
    if not list(baseline_dir.glob("*.csv")):
        pytest.skip("no local baseline CSVs (expected on a fresh clone)")
    materialise_cases(load_cases(), baseline_dir=baseline_dir)  # raises on drift


# --- schema validation ------------------------------------------------------


def test_unknown_schema_version_rejected(tmp_path):
    path = _write_cases(tmp_path / "cases.json", [_case_dict()], version=99)
    with pytest.raises(CaseError, match="schema_version"):
        load_cases(path)


def test_unknown_mutation_rejected(tmp_path):
    path = _write_cases(tmp_path / "cases.json", [_case_dict(mutation="nonsense")])
    with pytest.raises(CaseError, match="vocabulary"):
        load_cases(path)


def test_bad_label_rejected(tmp_path):
    path = _write_cases(tmp_path / "cases.json", [_case_dict(expected_faithfulness="maybe")])
    with pytest.raises(CaseError, match="expected_faithfulness"):
        load_cases(path)
    path = _write_cases(tmp_path / "cases2.json", [_case_dict(expected_quality="ok")])
    with pytest.raises(CaseError, match="expected_quality"):
        load_cases(path)


def test_missing_rationale_rejected(tmp_path):
    path = _write_cases(tmp_path / "cases.json", [_case_dict(rationale="  ")])
    with pytest.raises(CaseError, match="rationale"):
        load_cases(path)


def test_duplicate_case_id_rejected(tmp_path):
    path = _write_cases(tmp_path / "cases.json", [_case_dict(case_id=1), _case_dict(case_id=1)])
    with pytest.raises(CaseError, match="duplicate case_id"):
        load_cases(path)


# --------------------------------------------------------------------------
# 5. No copyrighted text or full answers committed
# --------------------------------------------------------------------------


def test_committed_case_file_holds_no_source_text():
    """Only identifiers, instructions, labels, rationales and hashes."""
    raw = json.loads(CASES_PATH.read_text())
    allowed_case_keys = {
        "case_id", "doc", "source_row", "concept_label", "mutation", "params",
        "expected_faithfulness", "expected_quality", "rationale",
        "question_sha", "answer_sha", "question_from_row", "question_from_sha",
    }
    for case in raw["cases"]:
        assert set(case) <= allowed_case_keys, f"unexpected key in case {case['case_id']}"
        assert "question" not in case
        assert "answer" not in case
        assert "contexts" not in case
        assert "retrieved_contexts" not in case
        assert len(case["question_sha"]) == 16
        assert len(case["answer_sha"]) == 16
        if case.get("question_from_row") is not None:
            assert len(case["question_from_sha"]) == 16


def test_committed_case_file_does_not_contain_baseline_answers():
    """Shingle the real answers against the committed file."""
    baseline_dir = Path(cc.RESULTS_DIR)
    if not list(baseline_dir.glob("*.csv")):
        pytest.skip("no local baseline CSVs (expected on a fresh clone)")
    from evals.calibrate import load_baseline_rows

    committed = re.sub(r"\s+", " ", CASES_PATH.read_text())
    cases = load_cases()
    by_doc: dict[str, set[int]] = {}
    for case in cases:
        by_doc.setdefault(case.doc, set()).update(case.source_rows())

    for doc, indexes in by_doc.items():
        for row in load_baseline_rows(doc, sorted(indexes), baseline_dir=baseline_dir):
            for text in (row.answer, row.question, " ".join(row.contexts)):
                flat = re.sub(r"\s+", " ", text).strip()
                shingles = {flat[i:i + 40] for i in range(0, max(1, len(flat) - 39), 7)}
                leaked = [s for s in shingles if s in committed]
                assert not leaked, f"{doc}:{row.row_index} leaked into the case file: {leaked[:1]}"


def test_mutation_texts_are_invented_not_quoted():
    """Every literal string committed as a mutation param must be original.

    Invented claims are safe to commit; excerpts are not. Each must be absent
    from every baseline answer and context it is applied to.
    """
    baseline_dir = Path(cc.RESULTS_DIR)
    if not list(baseline_dir.glob("*.csv")):
        pytest.skip("no local baseline CSVs (expected on a fresh clone)")

    for materialised in materialise_cases(load_cases(), baseline_dir=baseline_dir):
        text = materialised.case.params.get("text")
        if not text:
            continue
        haystack = re.sub(r"\s+", " ", " ".join(materialised.row.contexts)).lower()
        assert re.sub(r"\s+", " ", text).lower() not in haystack, (
            f"case {materialised.case.case_id} committed a context excerpt as mutation text"
        )


def test_no_secrets_in_committed_case_file():
    blob = CASES_PATH.read_text()
    for pattern in (r"sk-[A-Za-z0-9]{8,}", r"eyJ[A-Za-z0-9_-]{20,}", r"BEGIN [A-Z ]*PRIVATE"):
        assert not re.search(pattern, blob)


# --------------------------------------------------------------------------
# 6. Source CSVs unchanged; no network during materialisation
# --------------------------------------------------------------------------


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_materialisation_does_not_modify_source_csvs(baseline_dir, tmp_path):
    before = {p.name: _digest(p) for p in baseline_dir.iterdir()}
    path = _write_cases(tmp_path / "cases.json", [
        _case_dict(case_id=1),
        _case_dict(case_id=2, mutation="append_claim", params={"text": "Invented."},
                   expected_faithfulness=UNFAITHFUL),
    ])
    materialise_cases(load_cases(path), baseline_dir=baseline_dir)
    after = {p.name: _digest(p) for p in baseline_dir.iterdir()}
    assert after == before


def test_validate_cli_does_not_modify_source_csvs(baseline_dir, tmp_path):
    before = {p.name: _digest(p) for p in baseline_dir.iterdir()}
    path = _write_cases(tmp_path / "cases.json", [_case_dict()])
    assert cc.main(["--validate", "--cases", str(path), "--baseline-dir", str(baseline_dir)]) == 0
    assert {p.name: _digest(p) for p in baseline_dir.iterdir()} == before


def test_validate_cli_fails_on_missing_row(baseline_dir, tmp_path, capsys):
    path = _write_cases(tmp_path / "cases.json", [_case_dict(source_row=99)])
    assert cc.main(["--validate", "--cases", str(path), "--baseline-dir", str(baseline_dir)]) == 1


def test_materialisation_opens_no_network_connection(baseline_dir, tmp_path, monkeypatch):
    """Record rather than raise: callers with broad excepts could swallow a raise."""
    import socket

    attempts: list[str] = []
    real_socket = socket.socket

    def watched(*args, **kwargs):
        attempts.append("socket")
        return real_socket(*args, **kwargs)

    def watched_connect(*_a, **_k):
        attempts.append("create_connection")
        raise OSError("network disabled in test")

    monkeypatch.setattr(socket, "socket", watched)
    monkeypatch.setattr(socket, "create_connection", watched_connect)

    path = _write_cases(tmp_path / "cases.json", [_case_dict()])
    materialise_cases(load_cases(path), baseline_dir=baseline_dir)
    assert attempts == []


def test_case_module_imports_no_live_clients():
    probe = (
        "import sys; import evals.calibration_cases; "
        "banned=('qdrant_client','supabase','langfuse','ragas','app.core',"
        "'app.services','app.observability','openai'); "
        "print(sorted(m for m in sys.modules if m.startswith(banned)))"
    )
    backend = Path(cc.EVAL_DIR).parent
    result = subprocess.run(
        [sys.executable, "-c", probe], cwd=backend, capture_output=True, text=True,
        env={**os.environ, "PYTHONPATH": str(backend)},
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "[]", f"pulled in live deps: {result.stdout}"


def test_case_source_never_imports_retrieval_or_generation():
    source = (Path(cc.EVAL_DIR) / "calibration_cases.py").read_text()
    for banned in (
        "from app.services.retrieval", "from app.core.qdrant",
        "from app.core.supabase", "from app.services.llm",
        "from evals.run_ragas import", "langfuse",
    ):
        assert banned not in source, f"calibration_cases.py references {banned}"


def test_sentence_splitting_is_stable():
    assert split_sentences("One. Two! Three?") == ["One.", "Two!", "Three?"]
    assert split_sentences("") == []


def test_text_sha_is_whitespace_insensitive_and_short():
    assert text_sha("a  b\nc") == text_sha("a b c")
    assert len(text_sha("x")) == 16
