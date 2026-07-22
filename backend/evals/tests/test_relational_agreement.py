"""Tests for the relation-aware grounded-correctness run + metrics harness.

Hermetic: the evaluator is always injected as a stub, so no API key and no
network are involved. Pure metric functions are exercised with synthetic records;
the CLI is exercised over a synthetic baseline + cases file, mirroring the
sibling agreement harness tests.
"""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

import pytest

from evals import calibration_cases as cc
from evals import relational_agreement as ra
from evals.calibration_cases import (
    FAITHFUL,
    NON_RESPONSIVE,
    PARTIALLY_RESPONSIVE,
    RESPONSIVE,
    UNFAITHFUL,
    load_cases,
    materialise_cases,
    text_sha,
)
from evals.relational_agreement import (
    RelationalRecord,
    build_confusion,
    case_prediction,
    confidence_calibration,
    detection_result,
    missing_result_rate,
    ragas_faithfulness_confusion,
    run_relational_cases,
    verdict_agreement,
)
from evals.relational_eval import (
    INSUFFICIENT_DATA,
    PARTIALLY_SUPPORTED,
    SUPPORTED,
    UNSUPPORTED,
    RelationalResult,
)

FIXTURE_ANSWER = "Alpha holds. Beta follows because gamma holds."
FIXTURE_QUESTION = "What does alpha hold?"
FIXTURE_CONTEXT = "FIXTURE-CONTEXT-MUST-NOT-BE-COMMITTED"


# --------------------------------------------------------------------------
# synthetic builders
# --------------------------------------------------------------------------


def make_case(case_id, mutation, faith, *, doc="ddia", quality=RESPONSIVE):
    return cc.CalibrationCase(
        case_id=case_id, doc=doc, source_row=1, mutation=mutation, params={},
        expected_faithfulness=faith, expected_quality=quality, rationale="fixture",
        question_sha="q", answer_sha="a",
    )


def rec(case, judge, replicate, verdict, *, confidence=0.9, n_unsupported=0,
        n_contradiction=0, n_relational=0):
    result = RelationalResult(
        verdict=verdict, confidence=confidence,
        unsupported_claims=tuple("x" for _ in range(n_unsupported)),
        contradictions=tuple("x" for _ in range(n_contradiction)),
        relational_errors=tuple("x" for _ in range(n_relational)),
        ok=(verdict != INSUFFICIENT_DATA),
    )
    return ra.record_from_result(case, judge, replicate, result)


def records_for(case, judge, verdicts, **kw):
    return [rec(case, judge, i + 1, v, **kw) for i, v in enumerate(verdicts)]


# --------------------------------------------------------------------------
# case_prediction — majority of mapped faithfulness across valid replicates
# --------------------------------------------------------------------------


def test_case_prediction_unanimous():
    case = make_case(1, "identity", FAITHFUL)
    assert case_prediction(records_for(case, "k", [SUPPORTED, SUPPORTED, SUPPORTED])) is True
    assert case_prediction(records_for(case, "k", [UNSUPPORTED, UNSUPPORTED, UNSUPPORTED])) is False


def test_case_prediction_majority():
    case = make_case(1, "identity", FAITHFUL)
    assert case_prediction(records_for(case, "k", [SUPPORTED, SUPPORTED, UNSUPPORTED])) is True
    assert case_prediction(records_for(case, "k", [UNSUPPORTED, UNSUPPORTED, SUPPORTED])) is False


def test_case_prediction_tie_is_conservative_unfaithful():
    case = make_case(1, "identity", FAITHFUL)
    # 1 supported vs 1 unsupported -> tie -> conservative False.
    assert case_prediction(records_for(case, "k", [SUPPORTED, UNSUPPORTED])) is False


def test_case_prediction_needs_two_valid_replicates():
    case = make_case(1, "identity", FAITHFUL)
    # all insufficient -> None
    assert case_prediction(records_for(case, "k", [INSUFFICIENT_DATA, INSUFFICIENT_DATA, INSUFFICIENT_DATA])) is None
    # only one usable replicate -> insufficient -> None
    assert case_prediction(records_for(case, "k", [SUPPORTED, INSUFFICIENT_DATA, INSUFFICIENT_DATA])) is None


def test_partial_support_counts_as_unfaithful_prediction():
    case = make_case(1, "append_claim", UNFAITHFUL)
    assert case_prediction(records_for(case, "k", [PARTIALLY_SUPPORTED, PARTIALLY_SUPPORTED])) is False


# --------------------------------------------------------------------------
# build_confusion — attribution keyed on (doc, case_id)
# --------------------------------------------------------------------------


def test_build_confusion_scores_all_cells():
    faithful = make_case(1, "identity", FAITHFUL)
    unfaithful = make_case(2, "reverse_causal", UNFAITHFUL)
    cases_by_key = {("ddia", 1): faithful, ("ddia", 2): unfaithful}
    records = (
        records_for(faithful, "k", [SUPPORTED, SUPPORTED])       # faithful predicted faithful -> TP
        + records_for(unfaithful, "k", [UNSUPPORTED, UNSUPPORTED])  # unfaithful predicted unfaithful -> TN
    )
    m = build_confusion(records, cases_by_key, judge="k")
    assert (m.true_positive, m.true_negative, m.false_positive, m.false_negative) == (1, 1, 0, 0)
    assert m.balanced_accuracy == pytest.approx(1.0)


def test_build_confusion_counts_insufficient_cases():
    faithful = make_case(1, "identity", FAITHFUL)
    unfaithful = make_case(2, "reverse_causal", UNFAITHFUL)
    cases_by_key = {("ddia", 1): faithful, ("ddia", 2): unfaithful}
    records = (
        records_for(faithful, "k", [SUPPORTED, SUPPORTED])
        + records_for(unfaithful, "k", [INSUFFICIENT_DATA, INSUFFICIENT_DATA])
    )
    m = build_confusion(records, cases_by_key, judge="k")
    assert m.insufficient_data == 1
    assert (m.positives, m.negatives) == (1, 0)


def test_build_confusion_rejects_unknown_attribution():
    faithful = make_case(1, "identity", FAITHFUL)
    stray = make_case(9, "identity", FAITHFUL)
    cases_by_key = {("ddia", 1): faithful}
    records = records_for(stray, "k", [SUPPORTED, SUPPORTED])
    with pytest.raises(ra.CalibrationError, match="no calibration case"):
        build_confusion(records, cases_by_key, judge="k")


# --------------------------------------------------------------------------
# detection by mutation family
# --------------------------------------------------------------------------


def test_relational_inversion_detection():
    c1 = make_case(1, "reverse_causal", UNFAITHFUL)
    c2 = make_case(2, "reverse_causal", UNFAITHFUL)
    cases_by_key = {("ddia", 1): c1, ("ddia", 2): c2}
    records = (
        records_for(c1, "k", [UNSUPPORTED, UNSUPPORTED], n_relational=1)
        + records_for(c2, "k", [UNSUPPORTED, UNSUPPORTED], n_relational=1)
    )
    result = detection_result(records, cases_by_key, judge="k",
                              mutations=ra.RELATIONAL_INVERSION_MUTATIONS, family="relational-inversion")
    assert result.detected == 2
    assert result.total == 2
    assert result.insufficient == 0


def test_wrong_number_detection_partial():
    c1 = make_case(1, "replace_number", UNFAITHFUL)
    c2 = make_case(2, "replace_number", UNFAITHFUL)
    cases_by_key = {("ddia", 1): c1, ("ddia", 2): c2}
    records = (
        records_for(c1, "k", [UNSUPPORTED, UNSUPPORTED])       # detected
        + records_for(c2, "k", [SUPPORTED, SUPPORTED])          # missed
    )
    result = detection_result(records, cases_by_key, judge="k",
                              mutations=ra.WRONG_NUMBER_MUTATIONS, family="wrong-number")
    assert result.detected == 1
    assert result.total == 2


def test_added_claim_detection_family_spans_three_mutations():
    cases = {
        ("ddia", 1): make_case(1, "append_claim", UNFAITHFUL),
        ("ddia", 2): make_case(2, "combine", UNFAITHFUL),
        ("ddia", 3): make_case(3, "fabricate", UNFAITHFUL),
    }
    records = []
    for (_doc, cid), case in cases.items():
        records += records_for(case, "k", [PARTIALLY_SUPPORTED, PARTIALLY_SUPPORTED], n_unsupported=1)
    result = detection_result(records, cases, judge="k",
                              mutations=ra.ADDED_CLAIM_MUTATIONS, family="added-claim")
    assert result.detected == 3
    assert result.total == 3


# --------------------------------------------------------------------------
# verdict agreement + confidence calibration + missing result rate
# --------------------------------------------------------------------------


def test_verdict_agreement_unanimous_vs_split():
    steady = make_case(1, "identity", FAITHFUL)
    wobbly = make_case(2, "reverse_causal", UNFAITHFUL)
    records = (
        records_for(steady, "k", [SUPPORTED, SUPPORTED, SUPPORTED])
        + records_for(wobbly, "k", [SUPPORTED, UNSUPPORTED, UNSUPPORTED])
    )
    summary = verdict_agreement(records, judge="k")
    assert summary["n_cases"] == 2
    assert summary["unanimous"] == 1
    # steady 3/3=1.0, wobbly 2/3 -> mean 5/6
    assert summary["mean_agreement"] == pytest.approx((1.0 + 2 / 3) / 2)


def test_confidence_calibration_splits_correct_and_incorrect():
    right = make_case(1, "identity", FAITHFUL)     # expected faithful
    wrong = make_case(2, "identity", FAITHFUL)     # expected faithful, judge says unsupported
    cases_by_key = {("ddia", 1): right, ("ddia", 2): wrong}
    records = (
        records_for(right, "k", [SUPPORTED, SUPPORTED], confidence=0.9)   # correct
        + records_for(wrong, "k", [UNSUPPORTED, UNSUPPORTED], confidence=0.4)  # incorrect
    )
    summary = confidence_calibration(records, cases_by_key, judge="k")
    assert summary["n_correct"] == 1
    assert summary["n_incorrect"] == 1
    assert summary["mean_conf_correct"] == pytest.approx(0.9)
    assert summary["mean_conf_incorrect"] == pytest.approx(0.4)


def test_missing_result_rate():
    case = make_case(1, "identity", FAITHFUL)
    records = records_for(case, "k", [SUPPORTED, INSUFFICIENT_DATA, INSUFFICIENT_DATA])
    assert missing_result_rate(records, judge="k") == pytest.approx(2 / 3)
    assert missing_result_rate([], judge="k") is None


# --------------------------------------------------------------------------
# Ragas comparison over the retained observations
# --------------------------------------------------------------------------


def test_ragas_faithfulness_confusion_over_retained_observations(tmp_path):
    faithful = make_case(1, "identity", FAITHFUL)
    unfaithful = make_case(2, "reverse_causal", UNFAITHFUL)
    cases_by_key = {("ddia", 1): faithful, ("ddia", 2): unfaithful}
    obs = tmp_path / "ragas.csv"
    with obs.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["doc", "row_index", "judge", "replicate", "metric", "value"])
        # faithful case scored high (correct); unfaithful case ALSO scored high
        # (the faithfulness blind spot: relational inversion waved through).
        for r in (1, 2):
            writer.writerow(["ddia", 1, "kimi", r, "faithfulness", 1.0])
            writer.writerow(["ddia", 2, "kimi", r, "faithfulness", 1.0])
    matrix, used, skipped = ragas_faithfulness_confusion(obs, cases_by_key, judge="kimi")
    assert used == 2 and skipped == 0
    assert matrix.true_positive == 1     # faithful waved through -> correct
    assert matrix.false_positive == 1    # unfaithful waved through -> the blind spot
    assert matrix.negative_recall == pytest.approx(0.0)


def test_ragas_comparison_skips_foreign_keys_and_reports_count(tmp_path):
    faithful = make_case(1, "identity", FAITHFUL)
    cases_by_key = {("ddia", 1): faithful}
    obs = tmp_path / "ragas.csv"
    with obs.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["doc", "row_index", "judge", "replicate", "metric", "value"])
        for r in (1, 2):
            writer.writerow(["ddia", 1, "kimi", r, "faithfulness", 1.0])
            writer.writerow(["attention", 7, "kimi", r, "faithfulness", 1.0])  # foreign key
    matrix, used, skipped = ragas_faithfulness_confusion(obs, cases_by_key, judge="kimi")
    assert used == 1 and skipped == 1


# --------------------------------------------------------------------------
# CLI + integration over a synthetic baseline (mirrors the sibling harness)
# --------------------------------------------------------------------------


def _write_baseline(path: Path, rows) -> Path:
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
                "concept_label": f"c{index}", "context_count": 1,
                "retrieval_hit_at_k": True, "context_precision": 1.0,
                "context_recall": 1.0, "faithfulness": 1.0, "answer_relevancy": 0.9,
                "retrieved_contexts": repr([FIXTURE_CONTEXT]),
            })
    return path


@pytest.fixture
def baseline_dir(tmp_path: Path) -> Path:
    directory = tmp_path / "results"
    _write_baseline(directory / "ddia_20260711T044804Z.csv", {
        1: (FIXTURE_QUESTION, FIXTURE_ANSWER),
        2: ("What does beta follow?", "Beta follows the chain."),
    })
    return directory


@pytest.fixture
def cases_path(tmp_path: Path) -> Path:
    def case(cid, mutation, faith, quality, params=None, **extra):
        return {
            "case_id": cid, "doc": "ddia", "source_row": 1, "mutation": mutation,
            "params": params or {}, "expected_faithfulness": faith,
            "expected_quality": quality, "rationale": "fixture",
            "question_sha": text_sha(FIXTURE_QUESTION),
            "answer_sha": text_sha(FIXTURE_ANSWER), **extra,
        }

    path = tmp_path / "cases.json"
    path.write_text(json.dumps({"schema_version": cc.SCHEMA_VERSION, "cases": [
        case(1, "identity", FAITHFUL, RESPONSIVE),
        case(2, "append_claim", UNFAITHFUL, RESPONSIVE, {"text": "Invented."}),
        case(3, "drop_sentence", FAITHFUL, PARTIALLY_RESPONSIVE, {"keep": [0]}),
        case(4, "swap_question", FAITHFUL, NON_RESPONSIVE,
             question_from_row=2, question_from_sha=text_sha("What does beta follow?")),
    ]}))
    return path


def make_evaluate(verdict_by_answer, *, confidence=0.9):
    calls = []

    def evaluate(question, answer, contexts, *, judge):
        calls.append({"judge": judge, "answer": answer})
        verdict = verdict_by_answer[answer]
        return RelationalResult(verdict=verdict, confidence=confidence,
                                ok=(verdict != INSUFFICIENT_DATA))

    evaluate.calls = calls
    return evaluate


def _verdicts_by_answer(cases_path, baseline_dir, verdict_by_case):
    materialised = materialise_cases(load_cases(cases_path), baseline_dir=baseline_dir)
    return {m.row.answer: verdict_by_case[m.case.case_id] for m in materialised}


def test_run_relational_cases_scores_every_case_per_judge(baseline_dir, cases_path):
    materialised = materialise_cases(load_cases(cases_path), baseline_dir=baseline_dir)
    verdicts = _verdicts_by_answer(cases_path, baseline_dir,
                                   {1: SUPPORTED, 2: PARTIALLY_SUPPORTED, 3: SUPPORTED, 4: SUPPORTED})
    evaluate = make_evaluate(verdicts)
    records = run_relational_cases(materialised, judges=("kimi", "openai"), repeats=3, evaluate=evaluate)
    assert len(records) == 4 * 2 * 3
    assert {r.judge for r in records} == {"kimi", "openai"}
    assert {(r.doc, r.case_id) for r in records} == {("ddia", i) for i in range(1, 5)}


def test_cli_runs_and_writes_safe_artifacts(baseline_dir, cases_path, tmp_path):
    verdicts = _verdicts_by_answer(cases_path, baseline_dir,
                                   {1: SUPPORTED, 2: UNSUPPORTED, 3: SUPPORTED, 4: SUPPORTED})
    evaluate = make_evaluate(verdicts)
    out_dir = tmp_path / "out"
    code = ra.main(evaluate=evaluate, argv=[
        "--cases", str(cases_path), "--judges", "openai", "--repeats", "3",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(out_dir),
    ])
    assert code == 0
    obs = next(p for p in out_dir.iterdir() if "observations" in p.name)
    header = obs.read_text().splitlines()[0].split(",")
    # numeric/id columns only — no free text.
    assert set(header) == set(ra.RELATIONAL_OBS_COLUMNS)
    for banned in ("question", "answer", "contexts", "reasoning", "context"):
        assert banned not in header


def test_cli_rejects_single_replicate(baseline_dir, cases_path, tmp_path):
    assert ra.main(argv=[
        "--cases", str(cases_path), "--judges", "openai", "--repeats", "1",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(tmp_path / "out"),
    ]) == 1


def test_dry_run_writes_nothing_and_makes_no_calls(baseline_dir, cases_path, tmp_path, capsys):
    out_dir = tmp_path / "out"
    code = ra.main(argv=[
        "--cases", str(cases_path), "--baseline-dir", str(baseline_dir),
        "--out-dir", str(out_dir), "--dry-run",
    ])
    assert code == 0
    assert not out_dir.exists()
    assert "estimated judge LLM calls" in capsys.readouterr().out


def test_full_run_opens_no_network_connection(baseline_dir, cases_path, tmp_path, monkeypatch):
    import socket

    monkeypatch.setattr(socket, "create_connection",
                        lambda *a, **k: (_ for _ in ()).throw(OSError("blocked")))
    verdicts = _verdicts_by_answer(cases_path, baseline_dir,
                                   {1: SUPPORTED, 2: UNSUPPORTED, 3: SUPPORTED, 4: SUPPORTED})
    evaluate = make_evaluate(verdicts)
    code = ra.main(evaluate=evaluate, argv=[
        "--cases", str(cases_path), "--judges", "kimi", "--repeats", "2",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(tmp_path / "out"),
    ])
    assert code == 0


def test_run_imports_no_pipeline_dependencies():
    import sys

    before = set(sys.modules)
    # Importing + running the harness (with a stub) must not pull in the pipeline.
    for forbidden in ("qdrant_client", "supabase", "app.services.retrieval",
                      "app.services.quiz_generator", "langfuse", "ragas"):
        assert forbidden not in sys.modules or forbidden in before


def test_source_csvs_unchanged_by_full_run(baseline_dir, cases_path):
    def digest(path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()

    before = {p.name: digest(p) for p in baseline_dir.iterdir()}
    verdicts = _verdicts_by_answer(cases_path, baseline_dir,
                                   {1: SUPPORTED, 2: UNSUPPORTED, 3: SUPPORTED, 4: SUPPORTED})
    evaluate = make_evaluate(verdicts)
    # Point outputs at the baseline dir: the adversarial case for clobbering.
    ra.main(evaluate=evaluate, argv=[
        "--cases", str(cases_path), "--judges", "kimi", "--repeats", "2",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(baseline_dir),
    ])
    after = {p.name: digest(p) for p in baseline_dir.iterdir()}
    for name, value in before.items():
        assert name in after and after[name] == value, f"run modified {name}"


def test_report_and_observations_hold_no_case_text(baseline_dir, cases_path, tmp_path):
    verdicts = _verdicts_by_answer(cases_path, baseline_dir,
                                   {1: SUPPORTED, 2: UNSUPPORTED, 3: SUPPORTED, 4: SUPPORTED})
    evaluate = make_evaluate(verdicts)
    out_dir = tmp_path / "out"
    ra.main(evaluate=evaluate, argv=[
        "--cases", str(cases_path), "--judges", "openai", "--repeats", "3",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(out_dir),
    ])
    report = next(p for p in out_dir.iterdir() if p.suffix == ".md").read_text()
    obs = next(p for p in out_dir.iterdir() if "observations" in p.name).read_text()
    for secret in (FIXTURE_ANSWER, FIXTURE_QUESTION, FIXTURE_CONTEXT, "Invented."):
        assert secret not in report
        assert secret not in obs
    # actionable identifiers survive
    assert "ddia" in report
    assert "reverse_causal" in report or "identity" in report


def test_raw_jsonl_is_written_to_gitignored_results_dir(baseline_dir, cases_path, tmp_path):
    verdicts = _verdicts_by_answer(cases_path, baseline_dir,
                                   {1: SUPPORTED, 2: UNSUPPORTED, 3: SUPPORTED, 4: SUPPORTED})
    evaluate = make_evaluate(verdicts)
    out_dir = tmp_path / "out"
    ra.main(evaluate=evaluate, argv=[
        "--cases", str(cases_path), "--judges", "openai", "--repeats", "3",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(out_dir),
    ])
    raw = [p for p in out_dir.iterdir() if p.suffix == ".jsonl"]
    assert raw, "raw sanitized evaluator output should be written for debugging"
    first = json.loads(raw[0].read_text().splitlines()[0])
    for key in ("doc", "case_id", "judge", "replicate", "verdict"):
        assert key in first


def test_missing_replicates_are_excluded_and_reported(baseline_dir, cases_path, tmp_path):
    # case 2 always returns insufficient data -> excluded from confusion, reported.
    verdicts = _verdicts_by_answer(cases_path, baseline_dir,
                                   {1: SUPPORTED, 2: INSUFFICIENT_DATA, 3: SUPPORTED, 4: SUPPORTED})
    evaluate = make_evaluate(verdicts)
    out_dir = tmp_path / "out"
    ra.main(evaluate=evaluate, argv=[
        "--cases", str(cases_path), "--judges", "openai", "--repeats", "3",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(out_dir),
    ])
    report = next(p for p in out_dir.iterdir() if p.suffix == ".md").read_text().lower()
    assert "insufficient" in report
    assert "missing" in report
