"""Tests for judge-vs-human agreement scoring over the calibration cases.

Hermetic: the judge is a stub, so no API key and no network are involved.
"""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

import pytest

from evals import calibration_agreement as ag
from evals import calibration_cases as cc
from evals.calibrate import Aggregate, Observation, aggregate, metric_stability
from evals.calibration_agreement import (
    ConfusionMatrix,
    build_agreement_rows,
    build_report,
    confusion,
    faithfulness_class,
    missing_score_rate,
    responsiveness_class,
    run_cases,
    spread,
)
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

METRICS = ("faithfulness", "answer_relevancy")
FIXTURE_ANSWER = "Alpha holds. Beta follows because gamma holds."
FIXTURE_QUESTION = "What does alpha hold?"
FIXTURE_CONTEXT = "FIXTURE-CONTEXT-MUST-NOT-BE-COMMITTED"


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
        case(
            4,
            "swap_question",
            FAITHFUL,
            NON_RESPONSIVE,
            question_from_row=2,
            question_from_sha=text_sha("What does beta follow?"),
        ),
    ]}))
    return path


class StubResult:
    def __init__(self, frame):
        self._frame = frame

    def to_pandas(self):
        return self._frame


def make_evaluator(per_case: dict[int, dict[str, float]], *, judge_offset=None):
    """Stub judge returning a fixed score per case_id, echoing questions back."""
    import pandas as pd

    calls: list[dict] = []

    def evaluator(dataset, metrics, *, judge, llm=None, embeddings=None):
        calls.append({"judge": judge, "metrics": list(metrics)})
        questions = list(dataset["question"])
        n = len(questions)
        offset = (judge_offset or {}).get(judge, 0.0)
        data = {}
        for metric in metrics:
            column = []
            for position in range(n):
                case_id = position + 1
                value = per_case.get(case_id, {}).get(metric)
                column.append(None if value is None else min(1.0, max(0.0, value + offset)))
            data[metric] = column
        frame = pd.DataFrame(data)
        frame.insert(0, "question", questions)
        return StubResult(frame)

    evaluator.calls = calls  # type: ignore[attr-defined]
    return evaluator


# --------------------------------------------------------------------------
# Confusion-matrix arithmetic
# --------------------------------------------------------------------------


def test_confusion_matrix_rates():
    m = ConfusionMatrix(
        judge="kimi", metric="faithfulness", threshold=0.5,
        true_positive=8, false_negative=2, true_negative=6, false_positive=4,
    )
    assert m.positives == 10
    assert m.negatives == 10
    assert m.positive_recall == pytest.approx(0.8)
    assert m.negative_recall == pytest.approx(0.6)
    assert m.false_positive_rate == pytest.approx(0.4)
    assert m.false_negative_rate == pytest.approx(0.2)
    assert m.balanced_accuracy == pytest.approx(0.7)


def test_confusion_matrix_rates_sum_correctly():
    m = ConfusionMatrix("j", "faithfulness", 0.5, 3, 7, 5, 5)
    assert m.positive_recall + m.false_negative_rate == pytest.approx(1.0)
    assert m.negative_recall + m.false_positive_rate == pytest.approx(1.0)


def test_confusion_matrix_handles_empty_class():
    m = ConfusionMatrix("j", "faithfulness", 0.5, 0, 0, 3, 1)
    assert m.positives == 0
    assert m.positive_recall is None
    assert m.balanced_accuracy is None      # undefined, not silently 0.5
    assert m.negative_recall == pytest.approx(0.75)


def test_perfect_and_worthless_judges_score_as_expected():
    perfect = ConfusionMatrix("j", "faithfulness", 0.5, 12, 0, 12, 0)
    assert perfect.balanced_accuracy == pytest.approx(1.0)
    # A judge that calls everything faithful: catches every positive, no negative.
    lenient = ConfusionMatrix("j", "faithfulness", 0.5, 12, 0, 0, 12)
    assert lenient.positive_recall == pytest.approx(1.0)
    assert lenient.negative_recall == pytest.approx(0.0)
    assert lenient.balanced_accuracy == pytest.approx(0.5)
    assert lenient.false_positive_rate == pytest.approx(1.0)


def test_confusion_uses_mean_and_threshold(cases_path):
    cases = {(c.doc, c.case_id): c for c in load_cases(cases_path)}
    aggregates = [
        Aggregate("ddia", 1, "kimi", "faithfulness", 3, 0.90, 0, 0.9, 0.9, 0.0),  # faithful  -> TP
        Aggregate("ddia", 2, "kimi", "faithfulness", 3, 0.80, 0, 0.8, 0.8, 0.0),  # unfaithful-> FP
        Aggregate("ddia", 3, "kimi", "faithfulness", 3, 0.20, 0, 0.2, 0.2, 0.0),  # faithful  -> FN
        Aggregate("ddia", 4, "kimi", "faithfulness", 3, 0.10, 0, 0.1, 0.1, 0.0),  # faithful  -> FN
    ]
    m = confusion(aggregates, cases, judge="kimi", metric="faithfulness", threshold=0.5)
    assert (m.true_positive, m.false_negative, m.false_positive, m.true_negative) == (1, 2, 1, 0)


def test_threshold_changes_the_verdict(cases_path):
    cases = {(c.doc, c.case_id): c for c in load_cases(cases_path)}
    aggregates = [
        Aggregate("ddia", 1, "kimi", "faithfulness", 3, 0.6, 0, 0.6, 0.6, 0.0),
        Aggregate("ddia", 2, "kimi", "faithfulness", 3, 0.6, 0, 0.6, 0.6, 0.0),
    ]
    low = confusion(aggregates, cases, judge="kimi", metric="faithfulness", threshold=0.5)
    high = confusion(aggregates, cases, judge="kimi", metric="faithfulness", threshold=0.7)
    assert (low.true_positive, low.false_positive) == (1, 1)
    assert (high.false_negative, high.true_negative) == (1, 1)


def test_score_exactly_at_threshold_is_positive(cases_path):
    cases = {(c.doc, c.case_id): c for c in load_cases(cases_path)}
    aggregates = [
        Aggregate("ddia", 1, "kimi", "faithfulness", 2, 0.5, 0, 0.5, 0.5, 0.0),
        Aggregate("ddia", 2, "kimi", "faithfulness", 2, 0.5, 0, 0.5, 0.5, 0.0),
    ]
    matrix = confusion(
        aggregates, cases, judge="kimi", metric="faithfulness", threshold=0.5
    )
    assert (matrix.true_positive, matrix.false_positive) == (1, 1)


def test_confusion_rejects_wrong_document_attribution(cases_path):
    cases = {(c.doc, c.case_id): c for c in load_cases(cases_path)}
    aggregates = [
        Aggregate("attention", 1, "kimi", "faithfulness", 2, 1.0, 0, 1.0, 1.0, 0.0),
    ]
    with pytest.raises(ag.CalibrationError, match="no calibration case"):
        confusion(aggregates, cases, judge="kimi", metric="faithfulness")


def test_confusion_excludes_and_counts_insufficient_replicates(cases_path):
    cases = {(c.doc, c.case_id): c for c in load_cases(cases_path)}
    aggregates = [
        Aggregate("ddia", 1, "kimi", "faithfulness", 1, 1.0, 0, 1.0, 1.0, 0.0),
        Aggregate("ddia", 2, "kimi", "faithfulness", 2, 0.0, 0, 0.0, 0.0, 0.0),
        Aggregate("ddia", 3, "kimi", "faithfulness", 2, 1.0, 0, 1.0, 1.0, 0.0),
        Aggregate("ddia", 4, "kimi", "faithfulness", 2, 1.0, 0, 1.0, 1.0, 0.0),
    ]
    matrix = confusion(aggregates, cases, judge="kimi", metric="faithfulness")
    assert matrix.insufficient_data == 1
    assert (matrix.positives, matrix.negatives) == (2, 1)


def test_partially_responsive_excluded_from_strict_relevancy_matrix(cases_path):
    cases = {(c.doc, c.case_id): c for c in load_cases(cases_path)}
    aggregates = [
        Aggregate("ddia", i, "kimi", "answer_relevancy", 3, 0.9, 0, 0.9, 0.9, 0.0)
        for i in (1, 2, 3, 4)
    ]
    m = confusion(aggregates, cases, judge="kimi", metric="answer_relevancy", threshold=0.5)
    # cases 1,2 responsive -> positives; case 4 non_responsive -> negative;
    # case 3 partially_responsive -> excluded entirely
    assert m.positives == 2
    assert m.negatives == 1


def test_label_classifiers():
    Case = cc.CalibrationCase
    base = dict(case_id=1, doc="d", source_row=1, mutation="identity", params={},
                rationale="r", question_sha="x", answer_sha="y")
    assert faithfulness_class(Case(expected_faithfulness=FAITHFUL,
                                   expected_quality=RESPONSIVE, **base)) is True
    assert faithfulness_class(Case(expected_faithfulness=UNFAITHFUL,
                                   expected_quality=RESPONSIVE, **base)) is False
    partial = Case(expected_faithfulness=FAITHFUL, expected_quality=PARTIALLY_RESPONSIVE, **base)
    assert responsiveness_class(partial, strict=True) is None
    assert responsiveness_class(partial, strict=False) is False


# --------------------------------------------------------------------------
# Spread + missing-score accounting
# --------------------------------------------------------------------------


def test_missing_score_rate():
    observations = [
        Observation("d", 1, "kimi", 1, "faithfulness", 1.0),
        Observation("d", 1, "kimi", 2, "faithfulness", None),
        Observation("d", 1, "kimi", 3, "faithfulness", None),
        Observation("d", 1, "kimi", 1, "answer_relevancy", 0.5),
    ]
    assert missing_score_rate(observations, judge="kimi", metric="faithfulness") == pytest.approx(2 / 3)
    assert missing_score_rate(observations, judge="kimi", metric="answer_relevancy") == 0.0


def test_missing_score_rate_is_undefined_without_attempts():
    assert missing_score_rate([], judge="kimi", metric="faithfulness") is None


def test_spread_reports_mean_and_max_range():
    aggregates = [
        Aggregate("d", 1, "kimi", "faithfulness", 3, 0.5, 0.1, 0.4, 0.8, 0.4),
        Aggregate("d", 2, "kimi", "faithfulness", 3, 1.0, 0.0, 1.0, 1.0, 0.0),
    ]
    mean_range, max_range = spread(aggregates, judge="kimi", metric="faithfulness")
    assert mean_range == pytest.approx(0.2)
    assert max_range == pytest.approx(0.4)


def test_judge_failure_is_insufficient_not_stable():
    """A metric that mostly failed to score must not read as stable.

    Regression guard shared with the repeatability harness: range is 0.0 when
    only one replicate survived, which is indistinguishable from real stability
    unless coverage travels alongside.
    """
    observations = [
        Observation("d", 1, "kimi", 1, "faithfulness", 1.0),
        Observation("d", 1, "kimi", 2, "faithfulness", None),
        Observation("d", 1, "kimi", 3, "faithfulness", None),
    ]
    aggregates = aggregate(observations)
    stats = metric_stability(aggregates)[("faithfulness", "kimi")]
    assert stats["max_range"] == 0.0
    assert stats["min_n"] == 1
    from evals.calibrate import _gate_eligible, _verdict

    assert _verdict(stats) == "INSUFFICIENT DATA"
    assert _gate_eligible(stats)[0] is False


def test_cells_with_no_usable_score_are_excluded_from_confusion(cases_path):
    cases = {(c.doc, c.case_id): c for c in load_cases(cases_path)}
    observations = [Observation("ddia", 1, "kimi", r, "faithfulness", None) for r in (1, 2, 3)]
    m = confusion(aggregate(observations), cases, judge="kimi", metric="faithfulness")
    assert (m.positives, m.negatives) == (0, 0)


# --------------------------------------------------------------------------
# End-to-end over materialised cases
# --------------------------------------------------------------------------


def test_run_cases_scores_every_case_per_judge(baseline_dir, cases_path):
    materialised = materialise_cases(load_cases(cases_path), baseline_dir=baseline_dir)
    stub = make_evaluator({i: {"faithfulness": 1.0, "answer_relevancy": 0.9} for i in range(1, 5)})
    observations = run_cases(
        materialised, judges=("kimi", "openai"), repeats=3, evaluator=stub
    )
    assert len(observations) == 4 * 2 * 3 * len(METRICS)
    assert [c["judge"] for c in stub.calls] == ["kimi"] * 3 + ["openai"] * 3  # type: ignore[attr-defined]


def test_cli_judge_selection_still_works(baseline_dir, cases_path, tmp_path):
    stub = make_evaluator({i: {"faithfulness": 1.0, "answer_relevancy": 0.9} for i in range(1, 5)})
    exit_code = ag.main(evaluator=stub, argv=[
        "--cases", str(cases_path), "--judges", "openai", "--repeats", "2",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(tmp_path / "out"),
    ])
    assert exit_code == 0
    assert {c["judge"] for c in stub.calls} == {"openai"}  # type: ignore[attr-defined]


def test_cli_rejects_single_replicate(baseline_dir, cases_path, tmp_path):
    assert ag.main(argv=[
        "--cases", str(cases_path), "--judges", "kimi", "--repeats", "1",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(tmp_path / "out"),
    ]) == 1


def test_dry_run_makes_no_calls_and_writes_nothing(baseline_dir, cases_path, tmp_path, capsys):
    out_dir = tmp_path / "out"
    exit_code = ag.main(argv=[
        "--cases", str(cases_path), "--baseline-dir", str(baseline_dir),
        "--out-dir", str(out_dir), "--dry-run",
    ])
    assert exit_code == 0
    assert not out_dir.exists()
    assert "estimated judge LLM calls" in capsys.readouterr().out


def test_full_run_opens_no_network_connection(baseline_dir, cases_path, tmp_path, monkeypatch):
    import socket

    attempts: list[str] = []
    real_socket = socket.socket
    monkeypatch.setattr(socket, "socket",
                        lambda *a, **k: (attempts.append("socket"), real_socket(*a, **k))[1])
    monkeypatch.setattr(socket, "create_connection",
                        lambda *a, **k: (_ for _ in ()).throw(OSError("blocked")))

    stub = make_evaluator({i: {"faithfulness": 1.0, "answer_relevancy": 0.9} for i in range(1, 5)})
    ag.main(evaluator=stub, argv=[
        "--cases", str(cases_path), "--judges", "kimi", "--repeats", "2",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(tmp_path / "out"),
    ])
    assert attempts == []


def test_no_langfuse_upload_path_exists_in_agreement_module():
    """This runner has no upload path at all — nothing to gate."""
    source = (Path(cc.EVAL_DIR) / "calibration_agreement.py").read_text()
    assert "langfuse" not in source.lower()


def test_source_csvs_unchanged_by_full_run(baseline_dir, cases_path, tmp_path):
    def digest(path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()

    before = {p.name: digest(p) for p in baseline_dir.iterdir()}
    stub = make_evaluator({i: {"faithfulness": 1.0, "answer_relevancy": 0.9} for i in range(1, 5)})
    # Point outputs at the baseline dir: the adversarial case for clobbering.
    ag.main(evaluator=stub, argv=[
        "--cases", str(cases_path), "--judges", "kimi", "--repeats", "2",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(baseline_dir),
    ])
    after = {p.name: digest(p) for p in baseline_dir.iterdir()}
    for name, value in before.items():
        assert name in after and after[name] == value, f"run modified {name}"


# --------------------------------------------------------------------------
# Artifacts
# --------------------------------------------------------------------------


def test_replay_rebuilds_report_without_any_judge_call(baseline_dir, cases_path, tmp_path, monkeypatch):
    """Regenerating the report must not re-run the experiment."""
    stub = make_evaluator({i: {"faithfulness": 1.0, "answer_relevancy": 0.9} for i in range(1, 5)})
    out_dir = tmp_path / "out"
    ag.main(evaluator=stub, argv=[
        "--cases", str(cases_path), "--judges", "kimi", "--repeats", "2",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(out_dir),
    ])
    saved = next(p for p in out_dir.iterdir() if "observations" in p.name)

    def explode(*_a, **_k):  # pragma: no cover - only runs on failure
        raise AssertionError("replay must not invoke the judge")

    monkeypatch.setattr(ag, "run_cases", explode)
    monkeypatch.setattr(ag, "run_experiment", explode, raising=False)

    replay_dir = tmp_path / "replay"
    assert ag.main(argv=[
        "--cases", str(cases_path), "--replay", str(saved),
        "--baseline-dir", str(baseline_dir), "--out-dir", str(replay_dir),
    ]) == 0
    assert any(p.suffix == ".md" for p in replay_dir.iterdir())


def test_threshold_sweep_is_reported(baseline_dir, cases_path, tmp_path):
    """A single headline threshold would hide a cutoff-dependent verdict."""
    stub = make_evaluator({i: {"faithfulness": 1.0, "answer_relevancy": 0.9} for i in range(1, 5)})
    out_dir = tmp_path / "out"
    ag.main(evaluator=stub, argv=[
        "--cases", str(cases_path), "--judges", "kimi", "--repeats", "2",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(out_dir),
    ])
    matrix = next(p for p in out_dir.iterdir() if "matrix" in p.name)
    thresholds = {row["threshold"] for row in csv.DictReader(matrix.open())}
    assert len(thresholds) == len(ag.THRESHOLD_SWEEP) >= 5


def test_agreement_csv_has_all_required_columns(baseline_dir, cases_path, tmp_path):
    stub = make_evaluator({i: {"faithfulness": 1.0, "answer_relevancy": 0.9} for i in range(1, 5)})
    out_dir = tmp_path / "out"
    ag.main(evaluator=stub, argv=[
        "--cases", str(cases_path), "--judges", "kimi", "--repeats", "2",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(out_dir),
    ])
    matrix = next(p for p in out_dir.iterdir() if "matrix" in p.name)
    header = matrix.read_text().splitlines()[0].split(",")
    for column in ("positive_recall", "negative_recall", "false_positive_rate",
                   "false_negative_rate", "balanced_accuracy", "mean_range",
                   "max_range", "missing_score_rate", "insufficient_data"):
        assert column in header


def test_report_holds_no_case_text(baseline_dir, cases_path):
    cases = load_cases(cases_path)
    materialised = materialise_cases(cases, baseline_dir=baseline_dir)
    stub = make_evaluator({i: {"faithfulness": 1.0, "answer_relevancy": 0.9} for i in range(1, 5)})
    observations = run_cases(materialised, judges=("kimi",), repeats=2, evaluator=stub)
    aggregates = aggregate(observations)
    rows = build_agreement_rows(
        observations, aggregates, {(c.doc, c.case_id): c for c in cases},
        judges=("kimi",), metrics=METRICS,
    )
    report = build_report(
        observations=observations, aggregates=aggregates, agreement_rows=rows,
        cases=cases, judges=("kimi",), metrics=METRICS, repeats=2,
        generated_at="20260720T000000Z",
    )
    assert FIXTURE_CONTEXT not in report
    assert FIXTURE_ANSWER not in report
    assert FIXTURE_QUESTION not in report
    assert "Invented." not in report
    # identifiers that make it actionable survive
    assert "ddia:1" in report
    assert "faithfulness" in report
    assert "balanced acc" in report


def test_report_states_required_methodological_limitations(baseline_dir, cases_path):
    cases = load_cases(cases_path)
    materialised = materialise_cases(cases, baseline_dir=baseline_dir)
    stub = make_evaluator({
        i: {"faithfulness": 1.0, "answer_relevancy": 0.9} for i in range(1, 5)
    })
    observations = run_cases(materialised, judges=("kimi",), repeats=2, evaluator=stub)
    aggregates = aggregate(observations)
    rows = build_agreement_rows(
        observations,
        aggregates,
        {(c.doc, c.case_id): c for c in cases},
        judges=("kimi",),
        metrics=METRICS,
    )
    report = build_report(
        observations=observations,
        aggregates=aggregates,
        agreement_rows=rows,
        cases=cases,
        judges=("kimi",),
        metrics=METRICS,
        repeats=2,
        generated_at="20260720T000000Z",
    ).lower()
    for required in (
        "small sample",
        "threshold selection bias",
        "relational inversion",
        "responsiveness rather than correctness",
        "judge limitation",
        "metric limitation",
        "exploratory",
        "not held-out validation",
    ):
        assert required in report
