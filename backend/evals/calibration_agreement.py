"""Judge-vs-human agreement over the balanced calibration case set.

Repeatability told us whether a judge returns the *same* number twice. It could
not tell us whether that number is *right*, because the only labels available
were all "faithful" — a judge that never cried foul would have scored perfectly.
This module answers the other half: run both judges over cases with known
positive and negative labels, and measure both error directions.

It reuses the offline calibration harness end to end, so retrieval and answer
generation stay fixed and everything measured is the judge.

Run (from ``backend/``)::

    python -m evals.calibration_agreement --dry-run
    python -m evals.calibration_agreement --judges kimi,openai --repeats 3

A note on thresholds
--------------------
Human labels are binary; Ragas returns a continuous score. Turning one into the
other needs a cutoff, and the cutoff is a choice that changes the answer — so
the report shows a sweep alongside the headline number rather than quietly
picking one.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import logging
import statistics
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Optional, Sequence

from evals.calibrate import (
    Aggregate,
    CalibrationError,
    Observation,
    RESULTS_DIR,
    RUN_OUTPUT_DIR,
    aggregate,
    metric_stability,
    read_observations_csv,
    run_experiment,
    write_observations_csv,
)
from evals.calibration_cases import (
    CASES_PATH,
    FAITHFUL,
    MaterialisedCase,
    NON_RESPONSIVE,
    PARTIALLY_RESPONSIVE,
    RESPONSIVE,
    UNFAITHFUL,
    distribution,
    load_cases,
    materialise_cases,
)

logger = logging.getLogger("evals.calibration_agreement")

#: The two metrics under examination. Reported separately throughout: they
#: answer different questions and there is no reason to expect them to agree.
AGREEMENT_METRICS = ("faithfulness", "answer_relevancy")

#: Cutoff turning a continuous Ragas score into a binary prediction. 0.5 is a
#: neutral starting point, not a tuned value; the sweep shows what other
#: choices would have produced.
DEFAULT_THRESHOLD = 0.5
THRESHOLD_SWEEP = (0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.999)

_AGREEMENT_COLUMNS = (
    "judge", "metric", "threshold", "positives", "negatives",
    "true_positive", "false_negative", "true_negative", "false_positive",
    "positive_recall", "negative_recall", "false_positive_rate",
    "false_negative_rate", "balanced_accuracy",
    "insufficient_data", "mean_range", "max_range", "missing_score_rate",
)


@dataclass(frozen=True)
class ConfusionMatrix:
    """Judge predictions against human labels for one (judge, metric, threshold)."""

    judge: str
    metric: str
    threshold: float
    true_positive: int
    false_negative: int
    true_negative: int
    false_positive: int
    insufficient_data: int = 0

    @property
    def positives(self) -> int:
        return self.true_positive + self.false_negative

    @property
    def negatives(self) -> int:
        return self.true_negative + self.false_positive

    @property
    def positive_recall(self) -> Optional[float]:
        """Of cases a human called positive, how many did the judge agree on."""
        return self.true_positive / self.positives if self.positives else None

    @property
    def negative_recall(self) -> Optional[float]:
        """Of cases a human called negative, how many did the judge catch."""
        return self.true_negative / self.negatives if self.negatives else None

    @property
    def false_positive_rate(self) -> Optional[float]:
        """Unfaithful/non-responsive answers waved through. The leniency measure."""
        return self.false_positive / self.negatives if self.negatives else None

    @property
    def false_negative_rate(self) -> Optional[float]:
        """Good answers wrongly condemned. The false-alarm measure."""
        return self.false_negative / self.positives if self.positives else None

    @property
    def balanced_accuracy(self) -> Optional[float]:
        """Mean of the two recalls. 0.5 is what coin-flipping scores."""
        if self.positive_recall is None or self.negative_recall is None:
            return None
        return (self.positive_recall + self.negative_recall) / 2

    def as_row(
        self, *, mean_range: float, max_range: float, missing: Optional[float]
    ) -> dict[str, Any]:
        def fmt(value: Optional[float]) -> str:
            return "" if value is None else f"{value:.4f}"

        return {
            "judge": self.judge,
            "metric": self.metric,
            "threshold": self.threshold,
            "positives": self.positives,
            "negatives": self.negatives,
            "true_positive": self.true_positive,
            "false_negative": self.false_negative,
            "true_negative": self.true_negative,
            "false_positive": self.false_positive,
            "positive_recall": fmt(self.positive_recall),
            "negative_recall": fmt(self.negative_recall),
            "false_positive_rate": fmt(self.false_positive_rate),
            "false_negative_rate": fmt(self.false_negative_rate),
            "balanced_accuracy": fmt(self.balanced_accuracy),
            "insufficient_data": self.insufficient_data,
            "mean_range": f"{mean_range:.4f}",
            "max_range": f"{max_range:.4f}",
            "missing_score_rate": fmt(missing),
        }


# --------------------------------------------------------------------------
# Human label -> binary class
# --------------------------------------------------------------------------


def faithfulness_class(case) -> Optional[bool]:
    """True when a human called the answer faithful."""
    if case.expected_faithfulness == FAITHFUL:
        return True
    if case.expected_faithfulness == UNFAITHFUL:
        return False
    return None


def responsiveness_class(case, *, strict: bool = True) -> Optional[bool]:
    """True when a human called the answer responsive.

    ``strict`` excludes ``partially_responsive`` rather than forcing it to a
    side it does not belong on — a half-answered question is genuinely neither,
    and folding it either way would flatter or punish the judge by construction.
    """
    if case.expected_quality == RESPONSIVE:
        return True
    if case.expected_quality == NON_RESPONSIVE:
        return False
    if case.expected_quality == PARTIALLY_RESPONSIVE:
        return None if strict else False
    return None


_CLASSIFIERS: dict[str, Callable[[Any], Optional[bool]]] = {
    "faithfulness": faithfulness_class,
    "answer_relevancy": responsiveness_class,
}


# --------------------------------------------------------------------------
# Scoring + confusion
# --------------------------------------------------------------------------


def run_cases(
    materialised: Sequence[MaterialisedCase],
    *,
    judges: Sequence[str],
    repeats: int,
    metrics: Sequence[str] = AGREEMENT_METRICS,
    evaluator: Optional[Callable[..., Any]] = None,
) -> list[Observation]:
    """Score every case ``repeats`` times per judge. Retains all values."""
    rows = [m.as_scoring_row() for m in materialised]
    return run_experiment(
        rows, judges=judges, metrics=metrics, repeats=repeats, evaluator=evaluator
    )


def confusion(
    aggregates: Sequence[Aggregate],
    cases_by_key: dict[tuple[str, int], Any],
    *,
    judge: str,
    metric: str,
    threshold: float = DEFAULT_THRESHOLD,
    strict: bool = True,
) -> ConfusionMatrix:
    """Confusion matrix from per-case mean scores against human labels.

    The per-case *mean* across replicates is used rather than a single draw, so
    one unlucky replicate cannot decide a cell. Cases with fewer than two usable
    scores are excluded and counted as ``insufficient_data``; missing attempts
    are reported separately by :func:`missing_score_rate`.
    """
    classifier = _CLASSIFIERS[metric]
    relevant: dict[tuple[str, int], Aggregate] = {}
    for agg in aggregates:
        if agg.judge != judge or agg.metric != metric or agg.n == 0:
            continue
        key = (agg.doc, agg.row_index)
        if key not in cases_by_key:
            raise CalibrationError(
                f"observation {agg.doc}:{agg.row_index} has no calibration case; "
                "refusing ambiguous source-row attribution."
            )
        if key in relevant:
            raise CalibrationError(f"duplicate aggregate for {agg.doc}:{agg.row_index}.")
        relevant[key] = agg

    tp = fn = tn = fp = insufficient = 0
    for key, case in cases_by_key.items():
        expected = classifier(case) if metric == "faithfulness" else classifier(case, strict=strict)
        if expected is None:
            continue
        agg = relevant.get(key)
        if agg is None or agg.n < 2:
            insufficient += 1
            continue
        predicted = agg.mean >= threshold
        if expected and predicted:
            tp += 1
        elif expected and not predicted:
            fn += 1
        elif not expected and not predicted:
            tn += 1
        else:
            fp += 1
    return ConfusionMatrix(
        judge=judge, metric=metric, threshold=threshold,
        true_positive=tp, false_negative=fn, true_negative=tn, false_positive=fp,
        insufficient_data=insufficient,
    )


def missing_score_rate(
    observations: Iterable[Observation], *, judge: str, metric: str
) -> Optional[float]:
    """Share of scoring attempts that produced no usable number."""
    relevant = [o for o in observations if o.judge == judge and o.metric == metric]
    if not relevant:
        return None
    return sum(1 for o in relevant if o.value is None) / len(relevant)


def spread(aggregates: Sequence[Aggregate], *, judge: str, metric: str) -> tuple[float, float]:
    """(mean, max) run-to-run range for one judge/metric."""
    ranges = [
        a.value_range for a in aggregates
        if a.judge == judge and a.metric == metric and a.n > 1
    ]
    if not ranges:
        return 0.0, 0.0
    return statistics.fmean(ranges), max(ranges)


def build_agreement_rows(
    observations: Sequence[Observation],
    aggregates: Sequence[Aggregate],
    cases_by_key: dict[tuple[str, int], Any],
    *,
    judges: Sequence[str],
    metrics: Sequence[str],
    thresholds: Sequence[float] = (DEFAULT_THRESHOLD,),
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for metric in metrics:
        for judge in judges:
            mean_range, max_range = spread(aggregates, judge=judge, metric=metric)
            missing = missing_score_rate(observations, judge=judge, metric=metric)
            for threshold in thresholds:
                matrix = confusion(
                    aggregates, cases_by_key, judge=judge, metric=metric, threshold=threshold
                )
                rows.append(
                    matrix.as_row(mean_range=mean_range, max_range=max_range, missing=missing)
                )
    return rows


def write_agreement_csv(rows: Sequence[dict[str, Any]], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=_AGREEMENT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    return path


# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------


def _pct(value: str) -> str:
    return "n/a" if value == "" else f"{float(value):.3f}"


def build_report(
    *,
    observations: Sequence[Observation],
    aggregates: Sequence[Aggregate],
    agreement_rows: Sequence[dict[str, Any]],
    cases: Sequence[Any],
    judges: Sequence[str],
    metrics: Sequence[str],
    repeats: int,
    generated_at: str,
) -> str:
    """Markdown report. Identifiers, labels and numbers only — never case text."""
    counts = distribution(cases)
    stability = metric_stability(aggregates)

    lines: list[str] = []
    lines.append("# Judge agreement on balanced calibration cases")
    lines.append("")
    lines.append(f"Generated {generated_at} · {len(cases)} cases · {repeats} replicates/judge · "
                 f"judges: {', '.join(judges)}")
    lines.append("")
    lines.append("Retrieval and generation are held fixed; every case is a deterministic "
                 "mutation of a real pipeline answer scored against the contexts that answer "
                 "was generated from. All variation below is judge variation.")
    lines.append("")

    lines.append("## Case distribution")
    lines.append("")
    for name, tally in counts.items():
        rendered = ", ".join(f"`{k}` {v}" for k, v in tally.items())
        lines.append(f"- **{name}** — {rendered}")
    lines.append("")

    lines.append("## Agreement with human labels")
    lines.append("")
    lines.append(f"Positive class: `faithful` for faithfulness, `responsive` for answer "
                 f"relevancy. `partially_responsive` cases are excluded from the relevancy "
                 f"matrix rather than forced onto a side. Threshold {DEFAULT_THRESHOLD}; "
                 f"predictions use each case's mean across replicates.")
    lines.append("")
    lines.append("| metric | judge | pos | neg | TP | FN | TN | FP | pos recall | neg recall | FPR | FNR | balanced acc |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for row in agreement_rows:
        if float(row["threshold"]) != DEFAULT_THRESHOLD:
            continue
        lines.append(
            f"| {row['metric']} | `{row['judge']}` | {row['positives']} | {row['negatives']} | "
            f"{row['true_positive']} | {row['false_negative']} | {row['true_negative']} | "
            f"{row['false_positive']} | {_pct(row['positive_recall'])} | "
            f"{_pct(row['negative_recall'])} | {_pct(row['false_positive_rate'])} | "
            f"{_pct(row['false_negative_rate'])} | {_pct(row['balanced_accuracy'])} |"
        )
    lines.append("")
    lines.append("Balanced accuracy of 0.500 is chance. A judge with a high false-positive "
                 "rate is lenient: it waves through answers a human rejected.")
    lines.append("Cells with fewer than two usable judge observations are excluded as "
                 "insufficient data rather than treated as stable classifications.")
    lines.append("")

    lines.append("## Stability and coverage")
    lines.append("")
    lines.append("| metric | judge | replicates/row | mean range | max range | missing-score rate |")
    lines.append("|---|---|---|---|---|---|")
    seen: set[tuple[str, str]] = set()
    for row in agreement_rows:
        key = (row["metric"], row["judge"])
        if key in seen:
            continue
        seen.add(key)
        stats = stability.get((row["metric"], row["judge"]), {})
        n_span = int(stats.get("min_n", 0))
        lines.append(
            f"| {row['metric']} | `{row['judge']}` | {n_span} | {row['mean_range']} | "
            f"{row['max_range']} | {row['missing_score_rate']} |"
        )
    lines.append("")

    lines.append("## Threshold sensitivity")
    lines.append("")
    lines.append("Binary human labels versus a continuous score need a cutoff. If the verdict "
                 "flips across this sweep, the headline number is an artefact of the cutoff.")
    lines.append("Every threshold reuses the same fixed observations. This is exploratory "
                 "sensitivity analysis, not held-out validation.")
    lines.append("")
    lines.append("| metric | judge | threshold | pos recall | neg recall | balanced acc |")
    lines.append("|---|---|---|---|---|---|")
    for row in agreement_rows:
        lines.append(
            f"| {row['metric']} | `{row['judge']}` | {row['threshold']} | "
            f"{_pct(row['positive_recall'])} | {_pct(row['negative_recall'])} | "
            f"{_pct(row['balanced_accuracy'])} |"
        )
    lines.append("")

    best: dict[tuple[str, str], tuple[float, float]] = {}
    for row in agreement_rows:
        accuracy = row["balanced_accuracy"]
        if accuracy == "":
            continue
        key = (row["metric"], row["judge"])
        current = best.get(key)
        if current is None or float(accuracy) > current[1]:
            best[key] = (float(row["threshold"]), float(accuracy))
    if best:
        lines.append("### Best threshold observed")
        lines.append("")
        lines.append("Chosen by looking at these same cases, so it is an optimistic estimate — "
                     "a threshold picked on a set this small will not generalise unchanged. "
                     "Read it as 'the metric can do this well', not as a value to deploy.")
        lines.append("")
        lines.append("| metric | judge | best threshold | balanced acc |")
        lines.append("|---|---|---|---|")
        for (metric, judge), (threshold, accuracy) in sorted(best.items()):
            lines.append(f"| {metric} | `{judge}` | {threshold} | {accuracy:.3f} |")
        lines.append("")

    lines.append("## Methodological limitations")
    lines.append("")
    lines.append(f"This is a small sample ({len(cases)} cases), selected to cover known failure "
                 "modes rather than sampled to estimate production prevalence. Confidence "
                 "intervals would therefore overstate what the set establishes.")
    lines.append("")
    lines.append("The best cutoff has threshold selection bias because it was selected and "
                 "measured on these same observations; it is exploratory and must not be read "
                 "as held-out validation or a deployment threshold.")
    lines.append("")
    lines.append("Faithfulness has a relational inversion blind spot: a metric that decomposes "
                 "an answer into independently supported statements can miss a reversed causal "
                 "relationship even when both entities or events appear in the context.")
    lines.append("")
    lines.append("Answer relevancy measures responsiveness rather than correctness or "
                 "faithfulness. A topical but fabricated answer can score highly, so its label "
                 "and confusion matrix stay separate from factual support.")
    lines.append("")
    lines.append("Judge limitations and metric limitations are different. Judge limitations "
                 "include model-specific leniency and run-to-run variation; metric limitations "
                 "include the task definition, statement decomposition, and what evidence the "
                 "score is structurally able to represent. Agreement between judges does not "
                 "remove a shared metric limitation.")
    lines.append("")

    lines.append("## Per-case detail")
    lines.append("")
    lines.append("| case | doc:row | mutation | expected faith | expected quality | "
                 + " | ".join(f"{m} ({j})" for m in metrics for j in judges) + " |")
    lines.append("|---|---|---|---|---|" + "---|" * (len(metrics) * len(judges)))
    by_key = {(a.doc, a.row_index, a.judge, a.metric): a for a in aggregates}
    for case in sorted(cases, key=lambda c: c.case_id):
        cells = []
        for metric in metrics:
            for judge in judges:
                agg = by_key.get((case.doc, case.case_id, judge, metric))
                cells.append("n/a" if agg is None or agg.n == 0 else f"{agg.mean:.3f}")
        lines.append(
            f"| {case.case_id} | `{case.doc}:{case.source_row}` | {case.mutation} | "
            f"{case.expected_faithfulness} | {case.expected_quality} | " + " | ".join(cells) + " |"
        )
    lines.append("")
    lines.append(f"Raw observations: {len(observations)} individual scores.")
    lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def estimate_llm_calls(*, cases: int, judges: int, repeats: int) -> int:
    # faithfulness: statement split + NLI. answer_relevancy: strictness=3 gens.
    return cases * judges * repeats * 5


def main(
    argv: Optional[list[str]] = None, *, evaluator: Optional[Callable[..., Any]] = None
) -> int:
    parser = argparse.ArgumentParser(
        description="Measure judge agreement against balanced human calibration labels."
    )
    parser.add_argument("--cases", type=Path, default=CASES_PATH)
    parser.add_argument("--judges", default="kimi,openai")
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--baseline-dir", type=Path, default=RESULTS_DIR,
                        help="Directory of saved run_ragas result CSVs (read-only).")
    parser.add_argument("--out-dir", type=Path, default=RUN_OUTPUT_DIR,
                        help="Defaults to the gitignored run directory.")
    parser.add_argument("--tag", default="")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate cases and print the plan. No judge calls.")
    parser.add_argument("--replay", type=Path, default=None,
                        help="Rebuild the report from a saved observations CSV. No judge calls.")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        judges = tuple(j.strip() for j in args.judges.split(",") if j.strip())
        if not judges:
            raise CalibrationError("No judges selected.")
        if args.repeats < 2:
            raise CalibrationError(
                f"--repeats must be >= 2 to measure variance, got {args.repeats}."
            )

        cases = load_cases(args.cases)
        materialised = materialise_cases(cases, baseline_dir=args.baseline_dir)

        if args.dry_run:
            print(f"cases    : {len(cases)} (validated + materialised)")
            print(f"judges   : {', '.join(judges)}")
            print(f"repeats  : {args.repeats}")
            print(f"metrics  : {', '.join(AGREEMENT_METRICS)}")
            print(f"estimated judge LLM calls: ~"
                  f"{estimate_llm_calls(cases=len(cases), judges=len(judges), repeats=args.repeats)}")
            print("dry run — no API calls made, no files written.")
            return 0

        if args.replay:
            observations = read_observations_csv(args.replay)
            if not observations:
                raise CalibrationError(f"{args.replay} holds no observations.")
            judges = tuple(dict.fromkeys(o.judge for o in observations))
            repeats = max(
                max(o.replicate for o in observations if o.judge == j) for j in judges
            )
            logger.info("Replaying %d observations from %s", len(observations), args.replay.name)
        else:
            repeats = args.repeats
            observations = run_cases(
                materialised, judges=judges, repeats=repeats, evaluator=evaluator
            )
        aggregates = aggregate(observations)
        cases_by_key = {(c.doc, c.case_id): c for c in cases}
        agreement_rows = build_agreement_rows(
            observations, aggregates, cases_by_key,
            judges=judges, metrics=AGREEMENT_METRICS, thresholds=THRESHOLD_SWEEP,
        )

        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        suffix = f"_{args.tag}" if args.tag else ""
        obs_path = write_observations_csv(
            observations, args.out_dir / f"agreement_observations{suffix}_{stamp}.csv"
        )
        agr_path = write_agreement_csv(
            agreement_rows, args.out_dir / f"agreement_matrix{suffix}_{stamp}.csv"
        )
        report = build_report(
            observations=observations, aggregates=aggregates,
            agreement_rows=agreement_rows, cases=cases, judges=judges,
            metrics=AGREEMENT_METRICS, repeats=repeats, generated_at=stamp,
        )
        report_path = args.out_dir / f"agreement{suffix}_{stamp}.md"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report, encoding="utf-8")

        logger.info("Wrote %s", obs_path)
        logger.info("Wrote %s", agr_path)
        logger.info("Wrote %s", report_path)
        print(report)
        return 0
    except CalibrationError as exc:
        logger.error("%s", exc)
        return 1
    except Exception:
        logger.exception("Agreement run failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
