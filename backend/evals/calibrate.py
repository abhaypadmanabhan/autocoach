"""Judge-calibration harness — measures judge variance in isolation.

``run_ragas`` measures the whole pipeline at once: retrieval, answer generation
and judging all vary between runs, so a moved score cannot be attributed. This
module holds retrieval and generation **fixed** by replaying rows already saved
in a baseline CSV, and re-scores them N times per judge. Everything that moves
is then the judge.

It never calls Qdrant, never calls the answer-generation model, and never
writes to the baseline CSV it reads.

Run (from ``backend/``)::

    # what would run, no API calls
    python -m evals.calibrate --dry-run

    # the six-row calibration experiment
    python -m evals.calibrate \\
        --rows product_analytics:20,product_analytics:3,ddia:26,ddia:3,attention:7,attention:19 \\
        --judges kimi,openai --repeats 3

Outputs two artifacts under ``--out-dir``: a per-observation CSV (every
individual score, nothing aggregated away) and a Markdown report. Neither
contains retrieved context, generated answers, or credentials.
"""

from __future__ import annotations

import argparse
import ast
import csv
import datetime as dt
import json
import logging
import math
import statistics
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Optional, Sequence

logger = logging.getLogger("evals.calibrate")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

EVAL_DIR = Path(__file__).resolve().parent
RESULTS_DIR = EVAL_DIR / "results"
REPORTS_DIR = EVAL_DIR / "reports"
HUMAN_LABELS_PATH = EVAL_DIR / "calibration_labels.json"

#: Metrics available for calibration. faithfulness + answer_relevancy are the
#: subjects; the two context metrics are controls — they exercise the same judge
#: over the same rows, so if they hold still while the others move, the judge is
#: not uniformly noisy and the instability is metric-specific.
ALL_METRICS = ("faithfulness", "answer_relevancy", "context_precision", "context_recall")
DEFAULT_METRICS = ALL_METRICS
DEFAULT_REPEATS = 3

#: The six rows from the baseline audit: three where the judge scored a
#: verbatim-supported answer as unfaithful, one with known cross-run drift, and
#: two where answer_relevancy sat near 0.5 on a perfect answer.
DEFAULT_ROWS = (
    ("product_analytics", 20),
    ("product_analytics", 3),
    ("ddia", 26),
    ("ddia", 3),
    ("attention", 7),
    ("attention", 19),
)

#: Ragas LLM calls per row, per metric, at top_k=5 — used for the dry-run
#: estimate. faithfulness: statement split + NLI verdicts. answer_relevancy:
#: `strictness` (3) independent question generations. context_precision: one
#: verification per retrieved context. context_recall: one classification.
_LLM_CALLS_PER_ROW = {
    "faithfulness": 2,
    "answer_relevancy": 3,
    "context_precision": 5,
    "context_recall": 1,
}

_REQUIRED_BASELINE_COLUMNS = ("row_index", "question", "answer", "reference", "retrieved_contexts")


class CalibrationError(RuntimeError):
    """Baseline rows could not be loaded, or the experiment cannot proceed."""


@dataclass(frozen=True)
class BaselineRow:
    """One saved eval row, replayed offline. Retrieval/generation already done."""

    doc: str
    row_index: int
    question: str
    answer: str
    reference: str
    contexts: tuple[str, ...]
    concept_label: str = ""
    source_csv: str = ""

    @property
    def key(self) -> str:
        return f"{self.doc}:{self.row_index}"


@dataclass(frozen=True)
class Observation:
    """A single metric value from a single scoring pass. Never averaged away."""

    doc: str
    row_index: int
    judge: str
    replicate: int
    metric: str
    value: Optional[float]


@dataclass(frozen=True)
class Aggregate:
    """Repeatability statistics for one (row, judge, metric) cell."""

    doc: str
    row_index: int
    judge: str
    metric: str
    n: int
    mean: float
    stdev: float
    minimum: float
    maximum: float
    value_range: float


# --------------------------------------------------------------------------
# Baseline loading (offline — no Qdrant, no answer generation)
# --------------------------------------------------------------------------


def parse_contexts(raw: Any) -> tuple[str, ...]:
    """Parse the ``retrieved_contexts`` cell of a saved results CSV.

    ``run_ragas`` writes the column via ``DataFrame.to_csv``, which serialises
    the Python list with ``repr`` (single quotes) rather than JSON. Accept both
    so hand-edited or re-exported baselines still load.
    """
    if isinstance(raw, (list, tuple)):
        return tuple(str(item) for item in raw)
    text = (raw or "").strip()
    if not text:
        return ()
    for parser in (ast.literal_eval, json.loads):
        try:
            parsed = parser(text)
        except (ValueError, SyntaxError, TypeError):
            continue
        if isinstance(parsed, (list, tuple)):
            return tuple(str(item) for item in parsed)
    raise CalibrationError(
        "Could not parse 'retrieved_contexts' — expected a Python or JSON list, "
        f"got {text[:60]!r}..."
    )


def parse_row_selector(selector: str) -> tuple[tuple[str, int], ...]:
    """Parse ``"ddia:3,attention:7"`` into ``(("ddia", 3), ("attention", 7))``."""
    rows: list[tuple[str, int]] = []
    for token in (t.strip() for t in selector.split(",")):
        if not token:
            continue
        doc, _, raw_index = token.partition(":")
        doc = doc.strip()
        if not doc or not raw_index.strip():
            raise CalibrationError(
                f"Bad row selector {token!r}. Expected '<doc>:<row_index>', e.g. 'ddia:26'."
            )
        try:
            index = int(raw_index)
        except ValueError as exc:
            raise CalibrationError(
                f"Bad row index in {token!r}: {raw_index!r} is not an integer."
            ) from exc
        rows.append((doc, index))
    if not rows:
        raise CalibrationError("No rows selected.")
    return tuple(rows)


def _read_baseline_csv(path: Path) -> list[dict[str, str]]:
    # Contexts routinely exceed the default 128 KiB field cap.
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in _REQUIRED_BASELINE_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise CalibrationError(f"{path.name} is missing column(s): {', '.join(missing)}")
        return list(reader)


def resolve_baseline_csv(
    doc: str, row_indexes: Sequence[int], *, baseline_dir: Path = RESULTS_DIR
) -> Path:
    """Newest results CSV for ``doc`` that actually contains every requested row.

    Newest-overall is the wrong rule: partial re-runs (``--limit 5``) leave
    small, recent CSVs behind that would silently drop the rows under study.
    Timestamped filenames sort lexicographically, so reverse-sorted name order
    is newest-first.
    """
    candidates = sorted(baseline_dir.glob(f"{doc}_*.csv"), reverse=True)
    if not candidates:
        raise CalibrationError(
            f"No baseline CSV for doc {doc!r} in {baseline_dir}. "
            f"Run `python -m evals.run_ragas --doc {doc}` first."
        )
    wanted = set(row_indexes)
    for path in candidates:
        available = {int(r["row_index"]) for r in _read_baseline_csv(path) if r.get("row_index")}
        if wanted <= available:
            return path
    raise CalibrationError(
        f"No baseline CSV for {doc!r} contains all of rows {sorted(wanted)}. "
        f"Checked: {', '.join(p.name for p in candidates)}."
    )


def load_baseline_rows(
    doc: str, row_indexes: Sequence[int], *, baseline_dir: Path = RESULTS_DIR
) -> list[BaselineRow]:
    """Load saved rows for ``doc``. Read-only: the source CSV is never written."""
    path = resolve_baseline_csv(doc, row_indexes, baseline_dir=baseline_dir)
    by_index = {int(r["row_index"]): r for r in _read_baseline_csv(path) if r.get("row_index")}
    rows: list[BaselineRow] = []
    for index in row_indexes:
        raw = by_index.get(index)
        if raw is None:  # pragma: no cover - resolve_baseline_csv already checked
            raise CalibrationError(f"{path.name} has no row_index {index}.")
        contexts = parse_contexts(raw["retrieved_contexts"])
        if not contexts:
            raise CalibrationError(
                f"{path.name} row {index} has no retrieved contexts — "
                "cannot re-score offline."
            )
        rows.append(
            BaselineRow(
                doc=doc,
                row_index=index,
                question=raw["question"],
                answer=raw["answer"],
                reference=raw["reference"],
                contexts=contexts,
                concept_label=raw.get("concept_label", ""),
                source_csv=path.name,
            )
        )
    logger.info("Loaded %d row(s) for %s from %s", len(rows), doc, path.name)
    return rows


def load_selected_rows(
    selection: Sequence[tuple[str, int]], *, baseline_dir: Path = RESULTS_DIR
) -> list[BaselineRow]:
    """Load every ``(doc, row_index)`` pair, preserving the requested order."""
    by_doc: dict[str, list[int]] = {}
    for doc, index in selection:
        by_doc.setdefault(doc, []).append(index)
    loaded: dict[tuple[str, int], BaselineRow] = {}
    for doc, indexes in by_doc.items():
        for row in load_baseline_rows(doc, indexes, baseline_dir=baseline_dir):
            loaded[(row.doc, row.row_index)] = row
    return [loaded[pair] for pair in selection]


# --------------------------------------------------------------------------
# Scoring
# --------------------------------------------------------------------------


def build_offline_dataset(rows: Sequence[BaselineRow]) -> Any:
    """Ragas Dataset built purely from saved values — no live calls.

    Column names match ``run_ragas.build_dataset`` so the metrics behave
    identically to a normal eval run.
    """
    from datasets import Dataset  # lazy: keeps module import light

    return Dataset.from_dict(
        {
            "question": [r.question for r in rows],
            "answer": [r.answer for r in rows],
            "contexts": [list(r.contexts) for r in rows],
            "ground_truth": [r.reference for r in rows],
        }
    )


def default_offline_evaluator(
    dataset: Any, metrics: Sequence[str], *, judge: str, llm: Any = None, embeddings: Any = None
) -> Any:
    """Live Ragas evaluator bound to a named judge backend."""
    from ragas import evaluate  # lazy
    from ragas.metrics import (  # lazy
        answer_relevancy,
        context_precision,
        context_recall,
        faithfulness,
    )

    metric_objs = {
        "context_precision": context_precision,
        "context_recall": context_recall,
        "faithfulness": faithfulness,
        "answer_relevancy": answer_relevancy,
    }
    resolved = [metric_objs[m] if isinstance(m, str) else m for m in metrics]

    if llm is None or embeddings is None:
        from evals.judges import build_judge_embeddings, build_judge_llm  # lazy

        llm = llm or build_judge_llm(judge)
        embeddings = embeddings or build_judge_embeddings()

    return evaluate(dataset, metrics=resolved, llm=llm, embeddings=embeddings)


def _metric_value(raw: Any) -> Optional[float]:
    if raw is None or isinstance(raw, bool):
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(value) else value


def score_once(
    rows: Sequence[BaselineRow],
    *,
    judge: str,
    metrics: Sequence[str],
    replicate: int,
    evaluator: Optional[Callable[..., Any]] = None,
) -> list[Observation]:
    """One scoring pass over ``rows``. Returns one Observation per (row, metric).

    ``evaluator`` resolves at call time rather than binding the default at
    definition time, so tests can substitute a stub and never import ragas.
    """
    evaluator = evaluator or default_offline_evaluator
    dataset = build_offline_dataset(rows)
    result = evaluator(dataset, list(metrics), judge=judge)
    frame = result.to_pandas()
    if len(frame) != len(rows):
        raise CalibrationError(
            f"Judge {judge!r} returned {len(frame)} rows for {len(rows)} inputs."
        )

    observations: list[Observation] = []
    for position, row in enumerate(rows):
        for metric in metrics:
            value = _metric_value(frame[metric].iloc[position]) if metric in frame.columns else None
            if value is None:
                logger.warning(
                    "[%s rep %d] %s produced no value for %s",
                    judge, replicate, row.key, metric,
                )
            observations.append(
                Observation(
                    doc=row.doc,
                    row_index=row.row_index,
                    judge=judge,
                    replicate=replicate,
                    metric=metric,
                    value=value,
                )
            )
    return observations


def run_experiment(
    rows: Sequence[BaselineRow],
    *,
    judges: Sequence[str],
    metrics: Sequence[str] = DEFAULT_METRICS,
    repeats: int = DEFAULT_REPEATS,
    evaluator: Optional[Callable[..., Any]] = None,
) -> list[Observation]:
    """Score every row ``repeats`` times with every judge. Records all values."""
    if repeats < 2:
        raise CalibrationError(f"repeats must be >= 2 to measure variance, got {repeats}.")
    observations: list[Observation] = []
    for judge in judges:
        for replicate in range(1, repeats + 1):
            logger.info("judge=%s replicate=%d/%d rows=%d", judge, replicate, repeats, len(rows))
            observations.extend(
                score_once(
                    rows,
                    judge=judge,
                    metrics=metrics,
                    replicate=replicate,
                    evaluator=evaluator,
                )
            )
    return observations


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------


def aggregate(observations: Iterable[Observation]) -> list[Aggregate]:
    """Collapse observations into per-(row, judge, metric) repeatability stats.

    Uses the *sample* standard deviation (n-1), which is the right estimator for
    a handful of replicates drawn from the judge's output distribution. Cells
    with a single usable value report stdev/range 0.0 — that is an absence of
    evidence, not evidence of stability, so ``n`` is always reported alongside.
    """
    buckets: dict[tuple[str, int, str, str], list[float]] = {}
    for obs in observations:
        if obs.value is None:
            continue
        buckets.setdefault((obs.doc, obs.row_index, obs.judge, obs.metric), []).append(obs.value)

    aggregates: list[Aggregate] = []
    for (doc, row_index, judge, metric), values in buckets.items():
        aggregates.append(
            Aggregate(
                doc=doc,
                row_index=row_index,
                judge=judge,
                metric=metric,
                n=len(values),
                mean=statistics.fmean(values),
                stdev=statistics.stdev(values) if len(values) > 1 else 0.0,
                minimum=min(values),
                maximum=max(values),
                value_range=max(values) - min(values),
            )
        )
    aggregates.sort(key=lambda a: (a.metric, a.doc, a.row_index, a.judge))
    return aggregates


def metric_stability(aggregates: Sequence[Aggregate]) -> dict[tuple[str, str], dict[str, float]]:
    """Per-(metric, judge) rollup: worst-case range and mean dispersion."""
    buckets: dict[tuple[str, str], list[Aggregate]] = {}
    for agg in aggregates:
        buckets.setdefault((agg.metric, agg.judge), []).append(agg)
    return {
        key: {
            "rows": len(cells),
            "max_range": max(c.value_range for c in cells),
            "mean_range": statistics.fmean([c.value_range for c in cells]),
            "mean_stdev": statistics.fmean([c.stdev for c in cells]),
            "unstable_rows": sum(1 for c in cells if c.value_range > 0.0),
        }
        for key, cells in buckets.items()
    }


def load_human_labels(path: Path = HUMAN_LABELS_PATH) -> dict[str, dict[str, Any]]:
    """Hand-graded expectations, keyed ``"<doc>:<row_index>"``. Missing file is fine."""
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    return {f"{e['doc']}:{e['row_index']}": e for e in data.get("labels", [])}


def human_agreement(
    aggregates: Sequence[Aggregate], labels: dict[str, dict[str, Any]], *, metric: str
) -> dict[str, dict[str, float]]:
    """Mean absolute error of each judge against the hand-graded expectation."""
    errors: dict[str, list[float]] = {}
    for agg in aggregates:
        if agg.metric != metric:
            continue
        label = labels.get(f"{agg.doc}:{agg.row_index}")
        expected = (label or {}).get(f"{metric}_human")
        if expected is None:
            continue
        errors.setdefault(agg.judge, []).append(abs(agg.mean - float(expected)))
    return {
        judge: {"rows": len(vals), "mean_abs_error": statistics.fmean(vals), "max_abs_error": max(vals)}
        for judge, vals in errors.items()
        if vals
    }


# --------------------------------------------------------------------------
# Artifacts
# --------------------------------------------------------------------------

_OBSERVATION_COLUMNS = ("doc", "row_index", "judge", "replicate", "metric", "value")
_AGGREGATE_COLUMNS = (
    "doc", "row_index", "judge", "metric", "n", "mean", "stdev", "minimum", "maximum", "value_range",
)


def read_observations_csv(path: Path) -> list[Observation]:
    """Load a previously written observations CSV.

    Lets the report be regenerated from saved scores without paying for the
    judge calls again — the experiment is the expensive part, the prose is not.
    """
    with path.open(newline="", encoding="utf-8") as handle:
        return [
            Observation(
                doc=row["doc"],
                row_index=int(row["row_index"]),
                judge=row["judge"],
                replicate=int(row["replicate"]),
                metric=row["metric"],
                value=_metric_value(row["value"]) if row["value"] != "" else None,
            )
            for row in csv.DictReader(handle)
        ]


def write_observations_csv(observations: Sequence[Observation], path: Path) -> Path:
    """Every individual score, one row each. Contains no free text by design."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=_OBSERVATION_COLUMNS)
        writer.writeheader()
        for obs in observations:
            writer.writerow(asdict(obs))
    return path


def write_aggregates_csv(aggregates: Sequence[Aggregate], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=_AGGREGATE_COLUMNS)
        writer.writeheader()
        for agg in aggregates:
            row = asdict(agg)
            for key in ("mean", "stdev", "minimum", "maximum", "value_range"):
                row[key] = round(row[key], 6)
            writer.writerow(row)
    return path


#: A metric is only proposed as a regression gate if its worst observed
#: range across every calibration row stays under this. A gate that fires on
#: judge noise trains the team to ignore the gate.
GATE_MAX_RANGE = 0.05


def _verdict(stats: dict[str, float]) -> str:
    if stats["max_range"] == 0.0:
        return "STABLE"
    if stats["max_range"] <= GATE_MAX_RANGE:
        return "NEAR-STABLE"
    if stats["max_range"] <= 0.20:
        return "NOISY"
    return "UNSTABLE"


def build_report(
    *,
    observations: Sequence[Observation],
    aggregates: Sequence[Aggregate],
    rows: Sequence[BaselineRow],
    judges: Sequence[str],
    metrics: Sequence[str],
    repeats: int,
    labels: dict[str, dict[str, Any]],
    generated_at: str,
) -> str:
    """Markdown report. Emits identifiers and numbers only — never row text.

    Questions, generated answers and retrieved contexts are deliberately absent:
    the artifact is committed, and the source documents are third-party PDFs.
    """
    from evals.judges import describe_judge  # lazy: spec needs env for model name

    stability = metric_stability(aggregates)
    faith_agreement = human_agreement(aggregates, labels, metric="faithfulness")

    lines: list[str] = []
    lines.append("# Ragas judge calibration")
    lines.append("")
    lines.append(f"Generated {generated_at} · {repeats} replicates/judge · "
                 f"{len(rows)} rows · judges: {', '.join(judges)}")
    lines.append("")
    lines.append("Retrieval and answer generation are held fixed — every score below was "
                 "produced by replaying already-saved rows, so all observed variation is "
                 "judge variation.")
    lines.append("")

    lines.append("## Judges")
    lines.append("")
    lines.append("| judge | model | temperature | deterministic | note |")
    lines.append("|---|---|---|---|---|")
    for judge in judges:
        try:
            spec = describe_judge(judge)
            lines.append(
                f"| `{spec.name}` | `{spec.model}` | {spec.temperature} | "
                f"{'yes' if spec.deterministic else 'no'} | {spec.notes} |"
            )
        except Exception:  # pragma: no cover - spec needs env; report still renders
            lines.append(f"| `{judge}` | (unavailable) | | | |")
    lines.append("")

    lines.append("## Rows under test")
    lines.append("")
    lines.append("| row | concept | baseline CSV |")
    lines.append("|---|---|---|")
    for row in rows:
        lines.append(f"| `{row.key}` | {row.concept_label or '—'} | `{row.source_csv}` |")
    lines.append("")

    lines.append("## Stability by metric and judge")
    lines.append("")
    lines.append("| metric | judge | rows | rows that moved | max range | mean range | mean stdev | verdict |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for metric in metrics:
        for judge in judges:
            stats = stability.get((metric, judge))
            if not stats:
                continue
            lines.append(
                f"| {metric} | `{judge}` | {stats['rows']} | "
                f"{stats['unstable_rows']}/{stats['rows']} | {stats['max_range']:.3f} | "
                f"{stats['mean_range']:.3f} | {stats['mean_stdev']:.3f} | {_verdict(stats)} |"
            )
    lines.append("")

    lines.append("## Per-row detail")
    lines.append("")
    lines.append("| metric | row | judge | n | mean | stdev | min | max | range |")
    lines.append("|---|---|---|---|---|---|---|---|---|")
    for agg in aggregates:
        lines.append(
            f"| {agg.metric} | `{agg.doc}:{agg.row_index}` | `{agg.judge}` | {agg.n} | "
            f"{agg.mean:.3f} | {agg.stdev:.3f} | {agg.minimum:.3f} | {agg.maximum:.3f} | "
            f"{agg.value_range:.3f} |"
        )
    lines.append("")

    if faith_agreement:
        lines.append("## Agreement with manual inspection (faithfulness)")
        lines.append("")
        lines.append("Every calibration row was hand-checked: each answer's claims are all "
                     "supported by its retrieved contexts, so the human expectation is 1.000. "
                     "See `calibration_labels.json`.")
        lines.append("")
        lines.append("| judge | rows labelled | mean abs error | max abs error |")
        lines.append("|---|---|---|---|")
        for judge in judges:
            stats = faith_agreement.get(judge)
            if stats:
                lines.append(
                    f"| `{judge}` | {stats['rows']} | {stats['mean_abs_error']:.3f} | "
                    f"{stats['max_abs_error']:.3f} |"
                )
        lines.append("")

    lines.append("## Noise band")
    lines.append("")
    lines.append("Largest range observed on identical input — a score change smaller than "
                 "this is not evidence of a regression.")
    lines.append("")
    lines.append("| metric | judge | treat as noise below |")
    lines.append("|---|---|---|")
    for metric in metrics:
        for judge in judges:
            stats = stability.get((metric, judge))
            if stats:
                lines.append(f"| {metric} | `{judge}` | ±{stats['max_range']:.3f} |")
    lines.append("")

    lines.append("## Gate recommendation")
    lines.append("")
    lines.append(f"A metric is gate-eligible when its worst observed range stays at or below "
                 f"{GATE_MAX_RANGE:.2f} on identical input.")
    lines.append("")
    lines.append("**Eligibility here is repeatability only.** A metric that returns the same "
                 "number every time is safe to gate on *mechanically*, which is not the same as "
                 "that number being right. Pair this table with the agreement section above "
                 "before promoting any metric to a gate: a stable metric that disagrees with "
                 "manual inspection is a reliably wrong gate.")
    lines.append("")
    lines.append("| metric | judge | max range | gate-eligible |")
    lines.append("|---|---|---|---|")
    for metric in metrics:
        for judge in judges:
            stats = stability.get((metric, judge))
            if stats:
                eligible = "yes" if stats["max_range"] <= GATE_MAX_RANGE else "no — diagnostic only"
                lines.append(f"| {metric} | `{judge}` | {stats['max_range']:.3f} | {eligible} |")
    lines.append("")
    lines.append(f"Raw observations: {len(observations)} individual scores.")
    lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def estimate_llm_calls(
    *, rows: int, judges: int, repeats: int, metrics: Sequence[str]
) -> int:
    """Approximate judge calls for a planned run — used by ``--dry-run``."""
    per_row = sum(_LLM_CALLS_PER_ROW.get(m, 1) for m in metrics)
    return rows * judges * repeats * per_row


def _timestamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def main(
    argv: Optional[list[str]] = None, *, evaluator: Optional[Callable[..., Any]] = None
) -> int:
    parser = argparse.ArgumentParser(
        description="Re-score saved eval rows N times per judge to measure judge variance."
    )
    parser.add_argument(
        "--rows",
        default=",".join(f"{d}:{i}" for d, i in DEFAULT_ROWS),
        help="Comma-separated '<doc>:<row_index>' selectors.",
    )
    parser.add_argument(
        "--judges",
        default="kimi,openai",
        help="Comma-separated judge names. Selection is always explicit.",
    )
    parser.add_argument("--repeats", type=int, default=DEFAULT_REPEATS,
                        help="Scoring passes per judge (>= 2).")
    parser.add_argument("--metrics", default=",".join(DEFAULT_METRICS),
                        help=f"Comma-separated metrics from: {', '.join(ALL_METRICS)}.")
    parser.add_argument("--baseline-dir", type=Path, default=RESULTS_DIR,
                        help="Directory of saved run_ragas result CSVs (read-only).")
    parser.add_argument("--out-dir", type=Path, default=REPORTS_DIR,
                        help="Where the calibration CSVs + report are written.")
    parser.add_argument("--tag", default="", help="Optional suffix for output filenames.")
    parser.add_argument("--upload-langfuse", action="store_true",
                        help="Opt in to Langfuse upload. Off by default; calibration is local.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print the plan and estimated judge calls, then exit. No API calls.")
    parser.add_argument("--replay", type=Path, default=None,
                        help="Rebuild the report from a saved observations CSV. No API calls.")
    args = parser.parse_args(argv)

    try:
        selection = parse_row_selector(args.rows)
        judges = tuple(j.strip() for j in args.judges.split(",") if j.strip())
        metrics = tuple(m.strip() for m in args.metrics.split(",") if m.strip())
        unknown = [m for m in metrics if m not in ALL_METRICS]
        if unknown:
            raise CalibrationError(
                f"Unknown metric(s): {', '.join(unknown)}. Available: {', '.join(ALL_METRICS)}."
            )
        if not judges:
            raise CalibrationError("No judges selected.")

        if args.dry_run:
            calls = estimate_llm_calls(
                rows=len(selection), judges=len(judges), repeats=args.repeats, metrics=metrics
            )
            print(f"rows     : {len(selection)} -> {', '.join(f'{d}:{i}' for d, i in selection)}")
            print(f"judges   : {', '.join(judges)}")
            print(f"repeats  : {args.repeats}")
            print(f"metrics  : {', '.join(metrics)}")
            print(f"estimated judge LLM calls: ~{calls}")
            print("dry run — no API calls made, no files written.")
            return 0

        if args.replay:
            observations = read_observations_csv(args.replay)
            if not observations:
                raise CalibrationError(f"{args.replay} holds no observations.")
            selection = tuple(
                dict.fromkeys((o.doc, o.row_index) for o in observations)
            )
            judges = tuple(dict.fromkeys(o.judge for o in observations))
            metrics = tuple(dict.fromkeys(o.metric for o in observations))
            repeats = max(o.replicate for o in observations)
            rows = load_selected_rows(selection, baseline_dir=args.baseline_dir)
            logger.info("Replaying %d observations from %s", len(observations), args.replay.name)
        else:
            repeats = args.repeats
            rows = load_selected_rows(selection, baseline_dir=args.baseline_dir)
            observations = run_experiment(
                rows, judges=judges, metrics=metrics, repeats=repeats, evaluator=evaluator
            )
        aggregates = aggregate(observations)

        stamp = _timestamp()
        suffix = f"_{args.tag}" if args.tag else ""
        obs_path = write_observations_csv(
            observations, args.out_dir / f"judge_calibration_observations{suffix}_{stamp}.csv"
        )
        agg_path = write_aggregates_csv(
            aggregates, args.out_dir / f"judge_calibration_aggregates{suffix}_{stamp}.csv"
        )
        report = build_report(
            observations=observations,
            aggregates=aggregates,
            rows=rows,
            judges=judges,
            metrics=metrics,
            repeats=repeats,
            labels=load_human_labels(),
            generated_at=stamp,
        )
        report_path = args.out_dir / f"judge_calibration{suffix}_{stamp}.md"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report, encoding="utf-8")

        if args.upload_langfuse:
            _upload_to_langfuse(aggregates)

        logger.info("Wrote %s", obs_path)
        logger.info("Wrote %s", agg_path)
        logger.info("Wrote %s", report_path)
        print(report)
        return 0
    except CalibrationError as exc:
        logger.error("%s", exc)
        return 1
    except Exception:
        logger.exception("Calibration failed")
        return 1


def _upload_to_langfuse(aggregates: Sequence[Aggregate]) -> None:
    """Best-effort upload of calibration aggregates. Only ever called via --upload-langfuse."""
    try:
        from app.observability.langfuse import is_enabled, langfuse  # lazy
    except Exception:
        logger.info("Langfuse SDK unavailable — skipping upload")
        return
    if not is_enabled() or langfuse is None:
        logger.info("Langfuse not configured — skipping upload")
        return
    trace_id = langfuse.create_trace_id()
    for agg in aggregates:
        langfuse.create_score(
            trace_id=trace_id,
            name=f"calibration_{agg.metric}_range",
            value=agg.value_range,
            data_type="NUMERIC",
            metadata={"doc": agg.doc, "row_index": agg.row_index, "judge": agg.judge, "n": agg.n},
        )
    langfuse.flush()
    logger.info("Uploaded %d calibration aggregates to Langfuse", len(aggregates))


if __name__ == "__main__":
    sys.exit(main())
