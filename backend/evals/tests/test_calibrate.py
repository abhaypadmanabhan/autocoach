"""Tests for the judge-calibration harness.

Everything here runs hermetically: the judge is a stub, so no API key, no
Qdrant and no network are involved. The point of the module under test is that
scoring saved rows requires none of those — these tests hold it to that.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from evals import calibrate
from evals.calibrate import (
    Aggregate,
    BaselineRow,
    CalibrationError,
    Observation,
    aggregate,
    build_report,
    estimate_llm_calls,
    human_agreement,
    load_baseline_rows,
    load_selected_rows,
    metric_stability,
    parse_contexts,
    parse_row_selector,
    resolve_baseline_csv,
    run_experiment,
    score_once,
    write_aggregates_csv,
    write_observations_csv,
)

METRICS = ("faithfulness", "answer_relevancy")

# Text that must never reach a committed artifact.
SECRET_CONTEXT = "CONTEXT-BODY-SHOULD-NEVER-BE-WRITTEN-TO-DISK"
SECRET_ANSWER = "ANSWER-BODY-SHOULD-NEVER-BE-WRITTEN-TO-DISK"


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------


def _write_baseline_csv(path: Path, row_indexes, *, contexts_repr=True) -> Path:
    """Write a minimal results CSV shaped like run_ragas output."""
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
        for index in row_indexes:
            ctxs = [f"{SECRET_CONTEXT} ctx-a row{index}", f"{SECRET_CONTEXT} ctx-b row{index}"]
            writer.writerow({
                "row_index": index,
                "doc": "ddia",
                "document_label": "DDIA",
                "question": f"question {index}?",
                "answer": f"{SECRET_ANSWER} answer {index}",
                "reference": f"ideal {index}",
                "concept_label": f"concept {index}",
                "context_count": len(ctxs),
                "retrieval_hit_at_k": True,
                "context_precision": 1.0,
                "context_recall": 1.0,
                "faithfulness": 1.0,
                "answer_relevancy": 0.9,
                "retrieved_contexts": repr(ctxs) if contexts_repr else json.dumps(ctxs),
            })
    return path


@pytest.fixture
def baseline_dir(tmp_path: Path) -> Path:
    directory = tmp_path / "results"
    _write_baseline_csv(directory / "ddia_20260711T044804Z.csv", range(1, 6))
    return directory


@pytest.fixture
def rows(baseline_dir: Path) -> list[BaselineRow]:
    return load_baseline_rows("ddia", [1, 2], baseline_dir=baseline_dir)


class StubResult:
    def __init__(self, frame):
        self._frame = frame

    def to_pandas(self):
        return self._frame


def make_evaluator(script, *, echo_questions=True, reverse_rows=False, per_row=None):
    """Build a stub evaluator. ``script`` maps judge -> list of per-call value dicts.

    Mirrors ragas 0.2.15, whose ``to_pandas()`` concatenates the input dataset
    with the score frame — so the ``question`` column comes back too. Emitting
    it is what makes row/score misattribution observable at all.

    ``per_row`` overrides the flat script with one value dict per row, so tests
    can tell rows apart. ``reverse_rows`` simulates a judge returning results
    out of order.
    """
    import pandas as pd

    calls: list[dict] = []
    cursors: dict[str, int] = {}

    def evaluator(dataset, metrics, *, judge, llm=None, embeddings=None):
        calls.append({"dataset": dataset, "metrics": list(metrics), "judge": judge})
        index = cursors.get(judge, 0)
        cursors[judge] = index + 1
        questions = list(dataset["question"])
        n = len(questions)
        if per_row is not None:
            data = {m: [per_row[i][m] for i in range(n)] for m in metrics}
        else:
            values = script[judge][index]
            data = {m: [values[m]] * n for m in metrics}
        frame = pd.DataFrame(data)
        if echo_questions:
            frame.insert(0, "question", questions[::-1] if reverse_rows else questions)
        return StubResult(frame)

    evaluator.calls = calls  # type: ignore[attr-defined]
    return evaluator


# --------------------------------------------------------------------------
# 1. Scoring saved rows without live retrieval
# --------------------------------------------------------------------------


@pytest.fixture
def network_watch(monkeypatch):
    """Record socket use instead of raising on it.

    Raising is not enough: ``app.services.retrieval.retrieve_relevant_chunks``
    wraps its body in ``except Exception`` and returns ``[]``, so a guard that
    raises inside it is swallowed and the test passes while the call really
    went out. Recording moves the assertion into the test, where nothing can
    catch it.
    """
    import socket

    attempts: list[str] = []
    real_socket = socket.socket

    def watched_socket(*args, **kwargs):
        attempts.append("socket.socket")
        return real_socket(*args, **kwargs)

    def watched_connect(*args, **kwargs):
        attempts.append(f"create_connection{args[:1]}")
        raise OSError("network disabled in test")

    monkeypatch.setattr(socket, "socket", watched_socket)
    monkeypatch.setattr(socket, "create_connection", watched_connect)
    return attempts


def test_score_once_opens_no_network_connection(rows, network_watch):
    """Offline scoring must not touch the network at all.

    Patching ``evals.run_ragas.live_retrieve`` would prove nothing here —
    ``calibrate`` never imports ``run_ragas``, so such a patch can never fire.
    Watching the socket layer is the claim worth making: no Qdrant, no
    Supabase, no answer generation, no judge call.
    """
    evaluator = make_evaluator({"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}]})
    observations = score_once(
        rows, judge="kimi", metrics=METRICS, replicate=1, evaluator=evaluator
    )

    assert network_watch == [], f"offline scoring hit the network: {network_watch}"
    assert len(observations) == len(rows) * len(METRICS)
    assert {o.value for o in observations if o.metric == "faithfulness"} == {1.0}


def test_full_experiment_and_artifacts_open_no_network_connection(rows, tmp_path, network_watch):
    """The whole offline path — score, aggregate, write — stays off the network."""
    stub = make_evaluator({"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 3})
    observations = run_experiment(
        rows, judges=("kimi",), metrics=METRICS, repeats=3, evaluator=stub
    )
    aggregates = aggregate(observations)
    write_observations_csv(observations, tmp_path / "obs.csv")
    write_aggregates_csv(aggregates, tmp_path / "agg.csv")

    assert network_watch == [], f"calibration hit the network: {network_watch}"
    assert len(observations) == len(rows) * len(METRICS) * 3


def test_calibrate_source_never_imports_the_live_pipeline():
    """Static guard: a swallowed exception can hide a runtime call, not an import."""
    source = (Path(calibrate.EVAL_DIR) / "calibrate.py").read_text()
    code = "\n".join(
        line for line in source.splitlines()
        if not line.lstrip().startswith("#")
    )
    for banned in (
        "from evals.run_ragas import", "import evals.run_ragas",
        "from app.services.retrieval", "from app.core.qdrant",
        "from app.services.llm", "from app.core.supabase",
    ):
        assert banned not in code, f"calibrate.py imports the live pipeline: {banned}"


def test_offline_dataset_carries_saved_question_answer_contexts_reference(rows):
    evaluator = make_evaluator({"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}]})
    score_once(rows, judge="kimi", metrics=METRICS, replicate=1, evaluator=evaluator)

    dataset = evaluator.calls[0]["dataset"]  # type: ignore[attr-defined]
    assert dataset["question"] == [r.question for r in rows]
    assert dataset["answer"] == [r.answer for r in rows]
    assert dataset["ground_truth"] == [r.reference for r in rows]
    assert dataset["contexts"] == [list(r.contexts) for r in rows]


def test_no_qdrant_or_retrieval_imported_by_module():
    """Importing the calibrator must not drag in live clients or require keys.

    Checked in a subprocess: asserting on this process's ``sys.modules`` would
    pass or fail depending on what the rest of the suite imported first.
    """
    # Prefix matching, not a fixed allow-list: the claim covers Supabase and
    # Langfuse too, and a hardcoded set silently stops covering whatever gets
    # added later.
    probe = (
        "import sys; import evals.calibrate; "
        "banned=('qdrant_client','supabase','langfuse','ragas','datasets',"
        "'app.core','app.services','app.observability','openai'); "
        "print(sorted(m for m in sys.modules if m.startswith(banned)))"
    )
    result = subprocess.run(
        [sys.executable, "-c", probe],
        cwd=Path(calibrate.EVAL_DIR).parent,
        capture_output=True,
        text=True,
        env={**os.environ, "PYTHONPATH": str(Path(calibrate.EVAL_DIR).parent)},
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "[]", f"calibrate pulled in live deps: {result.stdout}"


def test_scores_land_on_the_row_they_were_computed_for(rows):
    """Scores are read positionally — prove they are attributed to the right row."""
    per_row = [
        {"faithfulness": 0.10, "answer_relevancy": 0.11},
        {"faithfulness": 0.90, "answer_relevancy": 0.99},
    ]
    evaluator = make_evaluator({}, per_row=per_row)
    observations = score_once(
        rows, judge="kimi", metrics=METRICS, replicate=1, evaluator=evaluator
    )

    got = {(o.row_index, o.metric): o.value for o in observations}
    assert got[(rows[0].row_index, "faithfulness")] == 0.10
    assert got[(rows[1].row_index, "faithfulness")] == 0.90
    assert got[(rows[0].row_index, "answer_relevancy")] == 0.11
    assert got[(rows[1].row_index, "answer_relevancy")] == 0.99


def test_out_of_order_judge_result_is_rejected_not_misattributed(rows):
    """A reordered result frame must fail loudly, never silently swap scores."""
    evaluator = make_evaluator(
        {},
        per_row=[
            {"faithfulness": 0.10, "answer_relevancy": 0.11},
            {"faithfulness": 0.90, "answer_relevancy": 0.99},
        ],
        reverse_rows=True,
    )
    with pytest.raises(CalibrationError, match="out of order"):
        score_once(rows, judge="kimi", metrics=METRICS, replicate=1, evaluator=evaluator)


def test_alignment_check_warns_when_it_cannot_verify(rows, caplog):
    """No echoed question column: fall back to positional, but say so."""
    evaluator = make_evaluator(
        {"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}]}, echo_questions=False
    )
    with caplog.at_level("WARNING"):
        score_once(rows, judge="kimi", metrics=METRICS, replicate=1, evaluator=evaluator)
    assert "cannot be verified" in caplog.text


def test_parse_contexts_accepts_repr_and_json():
    assert parse_contexts("['a', 'b']") == ("a", "b")
    assert parse_contexts('["a", "b"]') == ("a", "b")
    assert parse_contexts(["a", "b"]) == ("a", "b")
    assert parse_contexts("") == ()
    with pytest.raises(CalibrationError):
        parse_contexts("not-a-list")


def test_resolve_baseline_csv_skips_partial_reruns(tmp_path):
    """A newer 1-row re-run must not shadow the 30-row baseline."""
    directory = tmp_path / "results"
    _write_baseline_csv(directory / "ddia_20260711T044804Z.csv", range(1, 31))
    _write_baseline_csv(directory / "ddia_20260712T114255Z.csv", [1])

    assert resolve_baseline_csv("ddia", [26], baseline_dir=directory).name == (
        "ddia_20260711T044804Z.csv"
    )
    # ...but the newest file still wins when it does contain the rows.
    assert resolve_baseline_csv("ddia", [1], baseline_dir=directory).name == (
        "ddia_20260712T114255Z.csv"
    )


def test_missing_row_raises_actionable_error(baseline_dir):
    with pytest.raises(CalibrationError, match="contains all of rows"):
        load_baseline_rows("ddia", [99], baseline_dir=baseline_dir)


def test_load_selected_rows_preserves_request_order(baseline_dir):
    loaded = load_selected_rows([("ddia", 3), ("ddia", 1)], baseline_dir=baseline_dir)
    assert [r.row_index for r in loaded] == [3, 1]


# --------------------------------------------------------------------------
# 2. Judge selection through explicit configuration
# --------------------------------------------------------------------------


def test_each_judge_receives_its_own_name(rows):
    script = {
        "kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2,
        "openai": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2,
    }
    evaluator = make_evaluator(script)
    run_experiment(
        rows, judges=("kimi", "openai"), metrics=METRICS, repeats=2, evaluator=evaluator
    )
    seen = [c["judge"] for c in evaluator.calls]  # type: ignore[attr-defined]
    assert seen == ["kimi", "kimi", "openai", "openai"]


def test_cli_judges_flag_actually_drives_judge_selection(baseline_dir, tmp_path):
    """End-to-end: --judges must reach the evaluator, not just be parsed."""
    stub = make_evaluator({
        "openai": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2,
    })
    exit_code = calibrate.main(evaluator=stub, argv=[
        "--rows", "ddia:1", "--judges", "openai", "--repeats", "2",
        "--metrics", "faithfulness,answer_relevancy",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(tmp_path / "out"),
    ])

    assert exit_code == 0
    assert [c["judge"] for c in stub.calls] == ["openai", "openai"]  # type: ignore[attr-defined]


def test_environment_variables_cannot_change_judge_selection(baseline_dir, tmp_path, monkeypatch):
    """No env var may override an explicit --judges. Selection is CLI-only."""
    for name in ("EVAL_JUDGE", "JUDGE", "RAGAS_JUDGE", "CALIBRATION_JUDGE", "EVAL_JUDGE_MODEL"):
        monkeypatch.setenv(name, "openai")

    stub = make_evaluator({"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2})
    calibrate.main(evaluator=stub, argv=[
        "--rows", "ddia:1", "--judges", "kimi", "--repeats", "2",
        "--metrics", "faithfulness,answer_relevancy",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(tmp_path / "out"),
    ])

    assert [c["judge"] for c in stub.calls] == ["kimi", "kimi"]  # type: ignore[attr-defined]


def test_judge_registry_ignores_environment(monkeypatch):
    """build_judge_llm resolves purely from its argument."""
    from evals import judges

    monkeypatch.setenv("EVAL_JUDGE", "openai")
    built: list[str] = []
    monkeypatch.setitem(judges._JUDGE_BUILDERS, "kimi", lambda: built.append("kimi"))

    judges.build_judge_llm("kimi")
    assert built == ["kimi"]


def test_unknown_judge_rejected():
    from evals.judges import JudgeError, build_judge_llm, describe_judge

    with pytest.raises(JudgeError, match="Unknown judge"):
        build_judge_llm("gemini")
    with pytest.raises(JudgeError, match="Unknown judge"):
        describe_judge("gemini")


def test_default_judge_is_still_kimi():
    """Calibration must not silently swap the incumbent judge."""
    from evals import judges

    assert judges.DEFAULT_JUDGE == judges.JUDGE_KIMI
    assert set(judges.available_judges()) == {"kimi", "openai"}


def test_run_ragas_default_judge_untouched():
    """run_ragas must keep building the Kimi judge, not the calibration registry."""
    source = (Path(calibrate.EVAL_DIR) / "run_ragas.py").read_text()
    assert "from evals.kimi_judge import build_judge_embeddings, build_judge_llm" in source
    assert "evals.judges" not in source


def test_openai_judge_is_pinned_deterministic():
    from evals import judges

    spec = judges._openai_spec()
    assert spec.temperature == 0.0
    assert spec.deterministic is True
    assert judges.OPENAI_JUDGE_SEED == 0


def test_repeats_below_two_rejected(rows):
    with pytest.raises(CalibrationError, match="repeats must be >= 2"):
        run_experiment(rows, judges=("kimi",), metrics=METRICS, repeats=1)


# --------------------------------------------------------------------------
# 3. Repeated-run aggregation
# --------------------------------------------------------------------------


def test_run_experiment_records_every_individual_score(rows):
    script = {"kimi": [
        {"faithfulness": 1.0, "answer_relevancy": 0.90},
        {"faithfulness": 0.5, "answer_relevancy": 0.80},
        {"faithfulness": 1.0, "answer_relevancy": 0.85},
    ]}
    observations = run_experiment(
        rows, judges=("kimi",), metrics=METRICS, repeats=3, evaluator=make_evaluator(script)
    )

    assert len(observations) == len(rows) * len(METRICS) * 3
    assert sorted({o.replicate for o in observations}) == [1, 2, 3]
    faith = [o.value for o in observations if o.metric == "faithfulness" and o.row_index == 1]
    assert sorted(faith) == [0.5, 1.0, 1.0]


def test_aggregate_reports_n_mean_stdev_min_max_range():
    observations = [
        Observation("ddia", 3, "kimi", rep, "faithfulness", value)
        for rep, value in enumerate([1.0, 1.0, 0.667], start=1)
    ]
    (agg,) = aggregate(observations)

    assert agg.n == 3
    assert agg.minimum == pytest.approx(0.667)
    assert agg.maximum == pytest.approx(1.0)
    assert agg.value_range == pytest.approx(0.333)
    assert agg.mean == pytest.approx((1.0 + 1.0 + 0.667) / 3)
    # sample stdev (n-1), matching statistics.stdev
    assert agg.stdev == pytest.approx(0.19226, abs=1e-4)


def test_aggregate_uses_sample_stdev_not_population():
    observations = [
        Observation("d", 1, "j", rep, "faithfulness", v)
        for rep, v in enumerate([0.0, 1.0], start=1)
    ]
    (agg,) = aggregate(observations)
    assert agg.stdev == pytest.approx(0.70710678)  # n-1; population would be 0.5


def test_aggregate_drops_none_values_but_keeps_the_cell():
    observations = [
        Observation("d", 1, "j", 1, "faithfulness", 1.0),
        Observation("d", 1, "j", 2, "faithfulness", None),
        Observation("d", 1, "j", 3, "faithfulness", 1.0),
    ]
    (agg,) = aggregate(observations)
    assert agg.n == 2
    assert agg.value_range == 0.0


def test_aggregate_single_value_cell_reports_zero_spread():
    (agg,) = aggregate([Observation("d", 1, "j", 1, "faithfulness", 0.4)])
    assert (agg.n, agg.stdev, agg.value_range) == (1, 0.0, 0.0)


def test_aggregate_separates_judges_and_metrics():
    observations = [
        Observation("d", 1, "kimi", 1, "faithfulness", 0.0),
        Observation("d", 1, "openai", 1, "faithfulness", 1.0),
        Observation("d", 1, "kimi", 1, "answer_relevancy", 0.5),
    ]
    aggregates = aggregate(observations)
    assert len(aggregates) == 3
    assert {(a.judge, a.metric) for a in aggregates} == {
        ("kimi", "faithfulness"), ("openai", "faithfulness"), ("kimi", "answer_relevancy")
    }


def test_metric_stability_rollup():
    aggregates = [
        Aggregate("d", 1, "kimi", "faithfulness", 3, 0.8, 0.2, 0.6, 1.0, 0.4),
        Aggregate("d", 2, "kimi", "faithfulness", 3, 1.0, 0.0, 1.0, 1.0, 0.0),
    ]
    stats = metric_stability(aggregates)[("faithfulness", "kimi")]
    assert stats["rows"] == 2
    assert stats["max_range"] == pytest.approx(0.4)
    assert stats["mean_range"] == pytest.approx(0.2)
    assert stats["unstable_rows"] == 1
    assert stats["min_n"] == 3


def test_unmeasured_metric_is_not_reported_as_stable_or_gateable(baseline_dir):
    """A metric that mostly failed to score must never read as STABLE.

    Regression guard: range is 0.0 when a cell has one usable value, which is
    indistinguishable from real stability unless coverage travels with it. The
    dangerous outcome is a silently-unmeasurable metric being marked gate-safe.
    """
    rows = load_baseline_rows("ddia", [1], baseline_dir=baseline_dir)
    aggregates = [Aggregate("ddia", 1, "kimi", "faithfulness", 1, 1.0, 0.0, 1.0, 1.0, 0.0)]

    stats = metric_stability(aggregates)[("faithfulness", "kimi")]
    assert stats["min_n"] == 1
    assert calibrate._verdict(stats) == "INSUFFICIENT DATA"
    assert calibrate._gate_eligible(stats)[0] is False

    report = build_report(
        observations=[], aggregates=aggregates, rows=rows, judges=("kimi",),
        metrics=("faithfulness",), repeats=3, labels={},
        generated_at="20260720T000000Z",
    )
    assert "INSUFFICIENT DATA" in report
    assert "insufficient data" in report          # noise band
    assert "only 1 replicate(s)" in report        # gate table


def test_none_scores_do_not_masquerade_as_stability():
    """Dropping a failed replicate must shrink n, not just narrow the range."""
    observations = [
        Observation("d", 1, "kimi", 1, "faithfulness", 1.0),
        Observation("d", 1, "kimi", 2, "faithfulness", None),
        Observation("d", 1, "kimi", 3, "faithfulness", None),
    ]
    stats = metric_stability(aggregate(observations))[("faithfulness", "kimi")]
    assert stats["max_range"] == 0.0
    assert stats["min_n"] == 1
    assert calibrate._verdict(stats) == "INSUFFICIENT DATA"


def test_infinite_score_is_discarded_not_averaged_in():
    assert calibrate._metric_value(float("inf")) is None
    assert calibrate._metric_value(float("nan")) is None
    assert calibrate._metric_value(0.5) == 0.5


def test_duplicate_row_selectors_are_deduped():
    """Duplicates would double-count into one bucket and shrink apparent spread."""
    assert parse_row_selector("ddia:3,ddia:3,attention:7") == (("ddia", 3), ("attention", 7))


def test_human_agreement_scores_judges_against_manual_labels():
    aggregates = [
        Aggregate("ddia", 3, "kimi", "faithfulness", 3, 0.6, 0.2, 0.4, 1.0, 0.6),
        Aggregate("ddia", 3, "openai", "faithfulness", 3, 1.0, 0.0, 1.0, 1.0, 0.0),
    ]
    labels = {"ddia:3": {"doc": "ddia", "row_index": 3, "faithfulness_human": 1.0}}
    result = human_agreement(aggregates, labels, metric="faithfulness")
    assert result["kimi"]["mean_abs_error"] == pytest.approx(0.4)
    assert result["openai"]["mean_abs_error"] == pytest.approx(0.0)


def test_shipped_human_labels_file_is_valid():
    labels = calibrate.load_human_labels()
    assert len(labels) == 6
    for key in ("product_analytics:20", "ddia:3", "attention:7"):
        assert labels[key]["faithfulness_human"] == 1.0
        assert labels[key]["rationale"]


def test_shipped_labels_document_their_own_limitations():
    """The label set is all-1.000, which makes agreement figures easy to over-read."""
    raw = json.loads(calibrate.HUMAN_LABELS_PATH.read_text())
    limitations = " ".join(raw["known_limitations"]).lower()
    assert "no negative examples" in limitations
    assert "not a random sample" in limitations


def test_agreement_section_warns_against_over_reading(baseline_dir):
    rows = load_baseline_rows("ddia", [1], baseline_dir=baseline_dir)
    aggregates = [Aggregate("ddia", 1, "kimi", "faithfulness", 3, 0.6, 0.2, 0.4, 1.0, 0.6)]
    report = build_report(
        observations=[], aggregates=aggregates, rows=rows, judges=("kimi",),
        metrics=("faithfulness",), repeats=3,
        labels={"ddia:1": {"doc": "ddia", "row_index": 1, "faithfulness_human": 1.0}},
        generated_at="20260720T000000Z",
    )
    assert "no negative examples" in report
    assert "leniency rather than accuracy" in report


def test_estimate_llm_calls_matches_ragas_call_shape():
    # 1 row x 1 judge x 1 repeat: faithfulness 2 + answer_relevancy 3
    assert estimate_llm_calls(rows=1, judges=1, repeats=1, metrics=METRICS) == 5
    # the full six-row experiment across both judges
    assert estimate_llm_calls(
        rows=6, judges=2, repeats=3,
        metrics=("faithfulness", "answer_relevancy", "context_precision", "context_recall"),
    ) == 396


# --------------------------------------------------------------------------
# 4. Source baseline CSV is never mutated
# --------------------------------------------------------------------------


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_baseline_csv_not_mutated_by_full_experiment(baseline_dir, tmp_path):
    source = baseline_dir / "ddia_20260711T044804Z.csv"
    before = _digest(source)

    rows = load_baseline_rows("ddia", [1, 2], baseline_dir=baseline_dir)
    script = {"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 3}
    observations = run_experiment(
        rows, judges=("kimi",), metrics=METRICS, repeats=3, evaluator=make_evaluator(script)
    )
    write_observations_csv(observations, tmp_path / "obs.csv")
    write_aggregates_csv(aggregate(observations), tmp_path / "agg.csv")

    assert _digest(source) == before


def test_baseline_files_survive_main_writing_into_the_baseline_dir(baseline_dir):
    """The adversarial case: point --out-dir *at* the baseline directory.

    Writing beside the source files is the only way a run could plausibly
    clobber them, so digest every pre-existing file across a full main() run.
    """
    before = {p.name: _digest(p) for p in baseline_dir.iterdir()}
    stub = make_evaluator({"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2})

    exit_code = calibrate.main(evaluator=stub, argv=[
        "--rows", "ddia:1,ddia:2", "--judges", "kimi", "--repeats", "2",
        "--metrics", "faithfulness,answer_relevancy",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(baseline_dir),
    ])

    assert exit_code == 0
    after = {p.name: _digest(p) for p in baseline_dir.iterdir()}
    for name, digest in before.items():
        assert name in after, f"run deleted baseline file {name}"
        assert after[name] == digest, f"run modified baseline file {name}"


# --------------------------------------------------------------------------
# 5. Langfuse is opt-in only
# --------------------------------------------------------------------------


def test_no_langfuse_upload_by_default(baseline_dir, tmp_path, monkeypatch):
    uploads: list[int] = []
    monkeypatch.setattr(calibrate, "_upload_to_langfuse", lambda a: uploads.append(len(a)))
    stub = make_evaluator({"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2})

    exit_code = calibrate.main(evaluator=stub, argv=[
        "--rows", "ddia:1", "--judges", "kimi", "--repeats", "2",
        "--metrics", "faithfulness,answer_relevancy",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(tmp_path / "out"),
    ])

    assert exit_code == 0
    assert uploads == []


def test_langfuse_upload_only_with_explicit_flag(baseline_dir, tmp_path, monkeypatch):
    uploads: list[int] = []
    monkeypatch.setattr(calibrate, "_upload_to_langfuse", lambda a: uploads.append(len(a)))
    stub = make_evaluator({"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2})

    calibrate.main(evaluator=stub, argv=[
        "--rows", "ddia:1", "--judges", "kimi", "--repeats", "2",
        "--metrics", "faithfulness,answer_relevancy",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(tmp_path / "out"),
        "--upload-langfuse",
    ])

    assert uploads == [2]  # one aggregate per metric


def test_dry_run_makes_no_calls_and_writes_nothing(baseline_dir, tmp_path, capsys):
    out_dir = tmp_path / "out"
    exit_code = calibrate.main([
        "--rows", "ddia:1,ddia:2", "--judges", "kimi,openai", "--repeats", "3",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(out_dir), "--dry-run",
    ])

    assert exit_code == 0
    assert not out_dir.exists()
    assert "estimated judge LLM calls" in capsys.readouterr().out


# --------------------------------------------------------------------------
# 6. No secrets or retrieved text in committed artifacts
# --------------------------------------------------------------------------


def test_observation_csv_contains_no_row_text(baseline_dir, tmp_path):
    rows = load_baseline_rows("ddia", [1, 2], baseline_dir=baseline_dir)
    script = {"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2}
    observations = run_experiment(
        rows, judges=("kimi",), metrics=METRICS, repeats=2, evaluator=make_evaluator(script)
    )
    path = write_observations_csv(observations, tmp_path / "obs.csv")

    text = path.read_text()
    assert SECRET_CONTEXT not in text
    assert SECRET_ANSWER not in text
    assert "question 1?" not in text


def test_report_contains_no_context_answer_or_question_text(baseline_dir, tmp_path):
    rows = load_baseline_rows("ddia", [1, 2], baseline_dir=baseline_dir)
    script = {"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2}
    observations = run_experiment(
        rows, judges=("kimi",), metrics=METRICS, repeats=2, evaluator=make_evaluator(script)
    )
    report = build_report(
        observations=observations,
        aggregates=aggregate(observations),
        rows=rows,
        judges=("kimi",),
        metrics=METRICS,
        repeats=2,
        labels={},
        generated_at="20260720T000000Z",
    )

    assert SECRET_CONTEXT not in report
    assert SECRET_ANSWER not in report
    assert "question 1?" not in report
    assert "ideal 1" not in report
    # identifiers that make the report actionable are still present
    assert "ddia:1" in report
    assert "faithfulness" in report


def test_report_never_embeds_credentials(baseline_dir, tmp_path, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-should-never-appear")
    monkeypatch.setenv("KIMI_API_KEY", "kimi-should-never-appear")
    rows = load_baseline_rows("ddia", [1], baseline_dir=baseline_dir)
    observations = run_experiment(
        rows, judges=("kimi",), metrics=METRICS, repeats=2,
        evaluator=make_evaluator({"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2}),
    )
    report = build_report(
        observations=observations, aggregates=aggregate(observations), rows=rows,
        judges=("kimi",), metrics=METRICS, repeats=2, labels={},
        generated_at="20260720T000000Z",
    )
    assert "sk-should-never-appear" not in report
    assert "kimi-should-never-appear" not in report


def test_judge_spec_dict_holds_no_secret():
    from evals import judges

    spec = judges._openai_spec().as_dict()
    assert set(spec) == {"judge", "provider", "model", "temperature", "deterministic", "notes"}
    assert "api_key" not in json.dumps(spec)


# --------------------------------------------------------------------------
# 7. CLI plumbing
# --------------------------------------------------------------------------


def test_parse_row_selector():
    assert parse_row_selector("ddia:26, attention:7") == (("ddia", 26), ("attention", 7))
    with pytest.raises(CalibrationError):
        parse_row_selector("ddia")
    with pytest.raises(CalibrationError):
        parse_row_selector("ddia:abc")
    with pytest.raises(CalibrationError):
        parse_row_selector("")


def test_unknown_metric_rejected(baseline_dir, tmp_path):
    exit_code = calibrate.main([
        "--rows", "ddia:1", "--metrics", "bleu",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(tmp_path),
    ])
    assert exit_code == 1


def test_main_writes_all_three_artifacts(baseline_dir, tmp_path, monkeypatch):
    stub = make_evaluator({"kimi": [{"faithfulness": 1.0, "answer_relevancy": 0.9}] * 2})
    out_dir = tmp_path / "out"
    exit_code = calibrate.main(evaluator=stub, argv=[
        "--rows", "ddia:1", "--judges", "kimi", "--repeats", "2",
        "--metrics", "faithfulness,answer_relevancy",
        "--baseline-dir", str(baseline_dir), "--out-dir", str(out_dir), "--tag", "smoke",
    ])

    assert exit_code == 0
    names = sorted(p.name for p in out_dir.iterdir())
    assert sum(1 for n in names if n.endswith(".csv")) == 2
    assert sum(1 for n in names if n.endswith(".md")) == 1
    assert all("smoke" in n for n in names)


def test_evaluator_resolves_at_call_time_not_definition_time(rows, monkeypatch):
    """Regression: binding the default evaluator at def-time made the CLI untestable.

    ``score_once``/``run_experiment`` must read the module attribute when they
    run, so a stub swapped in afterwards is actually used.
    """
    stub = make_evaluator({"kimi": [{"faithfulness": 0.42, "answer_relevancy": 0.9}] * 2})
    monkeypatch.setattr(calibrate, "default_offline_evaluator", stub)

    observations = run_experiment(rows, judges=("kimi",), metrics=METRICS, repeats=2)

    assert stub.calls  # type: ignore[attr-defined]
    assert {o.value for o in observations if o.metric == "faithfulness"} == {0.42}


def test_observations_round_trip_through_csv(tmp_path):
    original = [
        Observation("ddia", 26, "kimi", 1, "faithfulness", 0.2),
        Observation("ddia", 26, "openai", 2, "faithfulness", None),
    ]
    path = write_observations_csv(original, tmp_path / "obs.csv")
    assert calibrate.read_observations_csv(path) == original


def test_replay_rebuilds_report_without_calling_any_judge(baseline_dir, tmp_path, monkeypatch):
    """Regenerating prose must not re-run the experiment."""

    def explode(*_args, **_kwargs):  # pragma: no cover - only runs on failure
        raise AssertionError("replay must not invoke the judge")

    monkeypatch.setattr(calibrate, "default_offline_evaluator", explode)
    monkeypatch.setattr(calibrate, "run_experiment", explode)

    obs_path = write_observations_csv(
        [
            Observation("ddia", 1, "kimi", rep, "faithfulness", value)
            for rep, value in enumerate([1.0, 0.5, 1.0], start=1)
        ],
        tmp_path / "saved.csv",
    )
    out_dir = tmp_path / "out"
    exit_code = calibrate.main([
        "--replay", str(obs_path),
        "--baseline-dir", str(baseline_dir), "--out-dir", str(out_dir),
    ])

    assert exit_code == 0
    reports = [p for p in out_dir.iterdir() if p.suffix == ".md"]
    assert len(reports) == 1
    assert "0.500" in reports[0].read_text()


def test_report_warns_that_stability_is_not_validity(baseline_dir):
    rows = load_baseline_rows("ddia", [1], baseline_dir=baseline_dir)
    report = build_report(
        observations=[], aggregates=[], rows=rows, judges=("kimi",),
        metrics=METRICS, repeats=3, labels={}, generated_at="20260720T000000Z",
    )
    assert "repeatability only" in report
    assert "reliably wrong gate" in report


def test_default_rows_match_the_six_row_experiment():
    assert calibrate.DEFAULT_ROWS == (
        ("product_analytics", 20),
        ("product_analytics", 3),
        ("ddia", 26),
        ("ddia", 3),
        ("attention", 7),
        ("attention", 19),
    )
