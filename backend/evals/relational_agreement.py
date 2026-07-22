"""Relation-aware grounded-correctness — run harness, metrics, and comparison.

Scores every balanced calibration case with the single-call relational evaluator
(:mod:`evals.relational_eval`), both judges, several replicates, then measures how
well the verdicts recover the binary ``expected_faithfulness`` labels and — the
whole point — whether it catches the relational failures Ragas ``faithfulness``
waves through. It compares against the retained Ragas faithfulness observations on
the same cases.

Diagnostic only. No gate is added, Ragas faithfulness is untouched, and the
default Ragas judge is unchanged. Retrieval and generation stay fixed: every case
is a deterministic mutation of a real pipeline answer, replayed offline, so all
variation measured here is evaluator variation.

Run (from ``backend/``)::

    python -m evals.relational_agreement --dry-run
    python -m evals.relational_agreement --judges kimi,openai --repeats 3 \
        --ragas-observations evals/reports/balanced_cases_observations.csv

All ``app``/``openai`` access lives in :mod:`evals.relational_eval` behind an
injectable transport, so this module and its CLI stay hermetic under test.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import logging
import statistics
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Optional, Sequence

from evals.calibrate import (
    CalibrationError,
    Observation,
    RESULTS_DIR,
    aggregate,
    read_observations_csv,
)
from evals.calibration_agreement import ConfusionMatrix, confusion, faithfulness_class
from evals.calibration_cases import (
    CASES_PATH,
    MaterialisedCase,
    distribution,
    load_cases,
    materialise_cases,
)
from evals.relational_eval import (
    INSUFFICIENT_DATA,
    KNOWN_VERDICTS,
    PARTIALLY_SUPPORTED,
    RelationalResult,
    evaluate_relational,
    verdict_to_faithful,
)

logger = logging.getLogger("evals.relational_agreement")

# EVAL_DIR reused via calibrate.RESULTS_DIR's parent.
EVAL_DIR = RESULTS_DIR.parent
REPORTS_DIR = EVAL_DIR / "reports"
#: Default output directory — under the gitignored results tree.
RELATIONAL_OUTPUT_DIR = RESULTS_DIR / "relational"
#: The retained Ragas faithfulness observations to compare against.
DEFAULT_RAGAS_OBS = REPORTS_DIR / "balanced_cases_observations.csv"

DEFAULT_JUDGES = "kimi,openai"
DEFAULT_REPEATS = 3
#: Two usable replicates are the floor for a majority prediction; below that a
#: case is insufficient data, not a classification.
MIN_REPLICATES = 2

#: Mutation families the report scores detection on, named for the report.
RELATIONAL_INVERSION_MUTATIONS = ("reverse_causal",)
WRONG_NUMBER_MUTATIONS = ("replace_number",)
ADDED_CLAIM_MUTATIONS = ("append_claim", "combine", "fabricate")

#: Numeric/id-only columns — safe to promote. Never any free text.
RELATIONAL_OBS_COLUMNS = (
    "doc", "case_id", "judge", "replicate", "verdict", "mapped_faithful",
    "confidence", "n_unsupported", "n_contradiction", "n_relational", "insufficient",
)


# --------------------------------------------------------------------------
# Records
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class RelationalRecord:
    """One evaluator verdict for one (case, judge, replicate). No free text."""

    doc: str
    case_id: int
    judge: str
    replicate: int
    verdict: str
    mapped_faithful: Optional[bool]
    confidence: Optional[float]
    n_unsupported: int
    n_contradiction: int
    n_relational: int
    insufficient: bool

    @property
    def key(self) -> tuple[str, int]:
        return (self.doc, self.case_id)


def record_from_result(case, judge: str, replicate: int, result: RelationalResult) -> RelationalRecord:
    return RelationalRecord(
        doc=case.doc,
        case_id=case.case_id,
        judge=judge,
        replicate=replicate,
        verdict=result.verdict,
        mapped_faithful=verdict_to_faithful(result.verdict),
        confidence=result.confidence,
        n_unsupported=len(result.unsupported_claims),
        n_contradiction=len(result.contradictions),
        n_relational=len(result.relational_errors),
        insufficient=(result.verdict == INSUFFICIENT_DATA),
    )


EvaluateFn = Callable[..., RelationalResult]


def run_relational_cases(
    materialised: Sequence[MaterialisedCase],
    *,
    judges: Sequence[str],
    repeats: int,
    evaluate: Optional[EvaluateFn] = None,
    raw_out: Optional[list] = None,
) -> list[RelationalRecord]:
    """Score every case ``repeats`` times per judge.

    ``evaluate`` defaults to :func:`evals.relational_eval.evaluate_relational`;
    tests inject a stub. When ``raw_out`` is supplied, one sanitized dict per call
    (including the model's claim text) is appended for local-only JSONL debugging.
    """
    run = evaluate or evaluate_relational
    records: list[RelationalRecord] = []
    for judge in judges:
        for replicate in range(1, repeats + 1):
            for materialised_case in materialised:
                case = materialised_case.case
                row = materialised_case.row
                result = run(row.question, row.answer, row.contexts, judge=judge)
                records.append(record_from_result(case, judge, replicate, result))
                if raw_out is not None:
                    raw_out.append({
                        "doc": case.doc,
                        "case_id": case.case_id,
                        "mutation": case.mutation,
                        "judge": judge,
                        "replicate": replicate,
                        "verdict": result.verdict,
                        "mapped_faithful": verdict_to_faithful(result.verdict),
                        "confidence": result.confidence,
                        "unsupported_claims": list(result.unsupported_claims),
                        "contradictions": list(result.contradictions),
                        "relational_errors": list(result.relational_errors),
                        "reasoning_summary": result.reasoning_summary,
                        "ok": result.ok,
                        "error": result.error,
                    })
    return records


# --------------------------------------------------------------------------
# Prediction + confusion
# --------------------------------------------------------------------------


def _group_by_case(records: Iterable[RelationalRecord], judge: str) -> dict[tuple[str, int], list[RelationalRecord]]:
    grouped: dict[tuple[str, int], list[RelationalRecord]] = {}
    for record in records:
        if record.judge != judge:
            continue
        grouped.setdefault(record.key, []).append(record)
    return grouped


def case_prediction(records: Sequence[RelationalRecord]) -> Optional[bool]:
    """Majority of the mapped faithfulness across a case's usable replicates.

    Fewer than :data:`MIN_REPLICATES` usable verdicts -> ``None`` (insufficient).
    A tie predicts ``False`` (unfaithful) — the conservative call, so a shaky
    grounded verdict is not credited as clean.
    """
    votes = [r.mapped_faithful for r in records if not r.insufficient and r.mapped_faithful is not None]
    if len(votes) < MIN_REPLICATES:
        return None
    faithful = sum(1 for v in votes if v)
    return faithful > (len(votes) - faithful)


def build_confusion(
    records: Sequence[RelationalRecord],
    cases_by_key: dict[tuple[str, int], Any],
    *,
    judge: str,
) -> ConfusionMatrix:
    """Confusion matrix (positive = faithful) from per-case majority verdicts.

    Cases with too few usable replicates are excluded and counted as
    ``insufficient_data``. A record whose ``(doc, case_id)`` has no calibration
    case raises — the same refusal-to-misattribute the sibling harness enforces.
    """
    grouped = _group_by_case(records, judge)
    for key in grouped:
        if key not in cases_by_key:
            raise CalibrationError(
                f"record {key[0]}:{key[1]} has no calibration case; "
                "refusing ambiguous source-row attribution."
            )

    tp = fn = tn = fp = insufficient = 0
    for key, case in cases_by_key.items():
        expected = faithfulness_class(case)
        if expected is None:
            continue
        predicted = case_prediction(grouped.get(key, []))
        if predicted is None:
            insufficient += 1
            continue
        if expected and predicted:
            tp += 1
        elif expected and not predicted:
            fn += 1
        elif not expected and not predicted:
            tn += 1
        else:
            fp += 1
    return ConfusionMatrix(
        judge=judge, metric="relational_grounded", threshold=0.5,
        true_positive=tp, false_negative=fn, true_negative=tn, false_positive=fp,
        insufficient_data=insufficient,
    )


# --------------------------------------------------------------------------
# Detection by mutation family
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class DetectionResult:
    family: str
    judge: str
    detected: int
    total: int
    insufficient: int

    @property
    def rate(self) -> Optional[float]:
        return self.detected / self.total if self.total else None


def detection_result(
    records: Sequence[RelationalRecord],
    cases_by_key: dict[tuple[str, int], Any],
    *,
    judge: str,
    mutations: Sequence[str],
    family: str,
) -> DetectionResult:
    """How many cases of ``mutations`` the judge flags unfaithful.

    ``total`` counts only cases with a usable prediction; ``insufficient`` counts
    the rest. Detection = the case was predicted unfaithful.
    """
    grouped = _group_by_case(records, judge)
    detected = total = insufficient = 0
    for key, case in cases_by_key.items():
        if case.mutation not in mutations:
            continue
        predicted = case_prediction(grouped.get(key, []))
        if predicted is None:
            insufficient += 1
            continue
        total += 1
        if predicted is False:  # unfaithful == the mutation was caught
            detected += 1
    return DetectionResult(family=family, judge=judge, detected=detected,
                           total=total, insufficient=insufficient)


# --------------------------------------------------------------------------
# Verdict agreement, confidence calibration, missing-result rate
# --------------------------------------------------------------------------


def verdict_agreement(records: Sequence[RelationalRecord], *, judge: str) -> dict[str, Any]:
    """Run-to-run stability: the modal-verdict share across replicates per case."""
    grouped = _group_by_case(records, judge)
    fractions: list[float] = []
    unanimous = 0
    for verdicts in ([r.verdict for r in group] for group in grouped.values()):
        if not verdicts:
            continue
        top = max(verdicts.count(v) for v in set(verdicts))
        fraction = top / len(verdicts)
        fractions.append(fraction)
        if fraction == 1.0:
            unanimous += 1
    return {
        "n_cases": len(fractions),
        "unanimous": unanimous,
        "mean_agreement": statistics.fmean(fractions) if fractions else None,
    }


def confidence_calibration(
    records: Sequence[RelationalRecord],
    cases_by_key: dict[tuple[str, int], Any],
    *,
    judge: str,
) -> dict[str, Any]:
    """Mean self-reported confidence when the case prediction is right vs wrong."""
    grouped = _group_by_case(records, judge)
    correct_conf: list[float] = []
    incorrect_conf: list[float] = []
    for key, case in cases_by_key.items():
        expected = faithfulness_class(case)
        group = grouped.get(key, [])
        predicted = case_prediction(group)
        if expected is None or predicted is None:
            continue
        confidences = [r.confidence for r in group if not r.insufficient and r.confidence is not None]
        if not confidences:
            continue
        mean_conf = statistics.fmean(confidences)
        (correct_conf if predicted == expected else incorrect_conf).append(mean_conf)
    return {
        "n_correct": len(correct_conf),
        "mean_conf_correct": statistics.fmean(correct_conf) if correct_conf else None,
        "n_incorrect": len(incorrect_conf),
        "mean_conf_incorrect": statistics.fmean(incorrect_conf) if incorrect_conf else None,
    }


def missing_result_rate(records: Sequence[RelationalRecord], *, judge: str) -> Optional[float]:
    """Share of scoring attempts that returned insufficient data (no usable verdict)."""
    relevant = [r for r in records if r.judge == judge]
    if not relevant:
        return None
    return sum(1 for r in relevant if r.insufficient) / len(relevant)


def verdict_counts(records: Sequence[RelationalRecord], *, judge: str) -> dict[str, int]:
    """Raw verdict tally per judge — surfaces partial-support behaviour separately."""
    counts = {v: 0 for v in (*KNOWN_VERDICTS, INSUFFICIENT_DATA)}
    for record in records:
        if record.judge == judge:
            counts[record.verdict] = counts.get(record.verdict, 0) + 1
    return counts


# --------------------------------------------------------------------------
# Ragas comparison over the retained observations
# --------------------------------------------------------------------------


def ragas_faithfulness_confusion(
    path: Path,
    cases_by_key: dict[tuple[str, int], Any],
    *,
    judge: str,
    threshold: float = 0.5,
) -> tuple[ConfusionMatrix, int, int]:
    """Reproduce the Ragas faithfulness confusion on the same cases.

    Foreign observations (a ``(doc, case_id)`` with no local case) are filtered
    out and counted rather than raising, so a subset of cases still compares. The
    kept observations are aggregated and scored with the sibling harness's
    :func:`confusion` at ``threshold``.
    """
    observations = [
        o for o in read_observations_csv(path)
        if o.metric == "faithfulness" and o.judge == judge
    ]
    kept = [o for o in observations if (o.doc, o.row_index) in cases_by_key]
    used = len({(o.doc, o.row_index) for o in kept})
    skipped = len({(o.doc, o.row_index) for o in observations} - set(cases_by_key))
    matrix = confusion(
        aggregate(kept), cases_by_key, judge=judge, metric="faithfulness", threshold=threshold
    )
    return matrix, used, skipped


# --------------------------------------------------------------------------
# CSV / JSONL IO
# --------------------------------------------------------------------------


def _fmt_bool(value: Optional[bool]) -> str:
    return "" if value is None else ("1" if value else "0")


def _fmt_float(value: Optional[float]) -> str:
    return "" if value is None else f"{value:.4f}"


def write_records_csv(records: Sequence[RelationalRecord], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=RELATIONAL_OBS_COLUMNS)
        writer.writeheader()
        for record in records:
            writer.writerow({
                "doc": record.doc,
                "case_id": record.case_id,
                "judge": record.judge,
                "replicate": record.replicate,
                "verdict": record.verdict,
                "mapped_faithful": _fmt_bool(record.mapped_faithful),
                "confidence": _fmt_float(record.confidence),
                "n_unsupported": record.n_unsupported,
                "n_contradiction": record.n_contradiction,
                "n_relational": record.n_relational,
                "insufficient": _fmt_bool(record.insufficient),
            })
    return path


def read_records_csv(path: Path) -> list[RelationalRecord]:
    with path.open(newline="", encoding="utf-8") as handle:
        records = []
        for row in csv.DictReader(handle):
            mapped = row["mapped_faithful"]
            records.append(RelationalRecord(
                doc=row["doc"],
                case_id=int(row["case_id"]),
                judge=row["judge"],
                replicate=int(row["replicate"]),
                verdict=row["verdict"],
                mapped_faithful=None if mapped == "" else mapped == "1",
                confidence=None if row["confidence"] == "" else float(row["confidence"]),
                n_unsupported=int(row["n_unsupported"]),
                n_contradiction=int(row["n_contradiction"]),
                n_relational=int(row["n_relational"]),
                insufficient=row["insufficient"] == "1",
            ))
    return records


def write_raw_jsonl(raw_items: Sequence[dict], path: Path) -> Path:
    """Local-only raw evaluator output for debugging. Gitignored — may hold claim text."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for item in raw_items:
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")
    return path


def write_metrics_csv(rows: Sequence[dict[str, Any]], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) if rows else ["metric"]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return path


# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------


def _pct(value: Optional[float]) -> str:
    return "n/a" if value is None else f"{value:.3f}"


def _modal_verdict(records: Sequence[RelationalRecord]) -> tuple[str, Optional[float]]:
    if not records:
        return "n/a", None
    verdicts = [r.verdict for r in records]
    top = max(set(verdicts), key=verdicts.count)
    confidences = [r.confidence for r in records if r.confidence is not None]
    return top, (statistics.fmean(confidences) if confidences else None)


def build_metric_rows(
    records: Sequence[RelationalRecord],
    cases_by_key: dict[tuple[str, int], Any],
    *,
    judges: Sequence[str],
) -> list[dict[str, Any]]:
    """Flat per-judge metric rows — the promotable numeric artifact."""
    rows: list[dict[str, Any]] = []
    for judge in judges:
        matrix = build_confusion(records, cases_by_key, judge=judge)
        agreement = verdict_agreement(records, judge=judge)
        calibration = confidence_calibration(records, cases_by_key, judge=judge)
        counts = verdict_counts(records, judge=judge)
        detections = {
            fam: detection_result(records, cases_by_key, judge=judge, mutations=muts, family=fam)
            for fam, muts in (
                ("relational_inversion", RELATIONAL_INVERSION_MUTATIONS),
                ("wrong_number", WRONG_NUMBER_MUTATIONS),
                ("added_claim", ADDED_CLAIM_MUTATIONS),
            )
        }
        rows.append({
            "judge": judge,
            "positives": matrix.positives,
            "negatives": matrix.negatives,
            "positive_recall": _fmt_float(matrix.positive_recall),
            "negative_recall": _fmt_float(matrix.negative_recall),
            "false_positive_rate": _fmt_float(matrix.false_positive_rate),
            "false_negative_rate": _fmt_float(matrix.false_negative_rate),
            "balanced_accuracy": _fmt_float(matrix.balanced_accuracy),
            "insufficient_data": matrix.insufficient_data,
            "missing_result_rate": _fmt_float(missing_result_rate(records, judge=judge)),
            "verdict_agreement": _fmt_float(agreement["mean_agreement"]),
            "unanimous_cases": agreement["unanimous"],
            "relational_inversion_detected": f"{detections['relational_inversion'].detected}/{detections['relational_inversion'].total}",
            "wrong_number_detected": f"{detections['wrong_number'].detected}/{detections['wrong_number'].total}",
            "added_claim_detected": f"{detections['added_claim'].detected}/{detections['added_claim'].total}",
            "mean_conf_correct": _fmt_float(calibration["mean_conf_correct"]),
            "mean_conf_incorrect": _fmt_float(calibration["mean_conf_incorrect"]),
            "n_supported": counts.get("supported", 0),
            "n_partially_supported": counts.get(PARTIALLY_SUPPORTED, 0),
            "n_unsupported": counts.get("unsupported", 0),
            "n_insufficient": counts.get(INSUFFICIENT_DATA, 0),
        })
    return rows


def build_report(
    *,
    records: Sequence[RelationalRecord],
    cases: Sequence[Any],
    judges: Sequence[str],
    repeats: int,
    generated_at: str,
    ragas: Optional[dict[str, tuple[ConfusionMatrix, int, int]]] = None,
) -> str:
    """Markdown report. Identifiers, labels, and numbers only — never case text."""
    cases_by_key = {(c.doc, c.case_id): c for c in cases}
    counts = distribution(cases)
    metric_rows = build_metric_rows(records, cases_by_key, judges=judges)
    by_judge = {row["judge"]: row for row in metric_rows}

    lines: list[str] = []
    lines.append("# Relation-aware grounded correctness on balanced calibration cases")
    lines.append("")
    lines.append(f"Generated {generated_at} · {len(cases)} cases · {repeats} replicates/judge · "
                 f"judges: {', '.join(judges)}")
    lines.append("")
    lines.append("Experimental, diagnostic evaluator. It asks one judge, in a single structured "
                 "call, whether the COMPLETE MEANING of an answer is supported by the retrieved "
                 "contexts — a question Ragas faithfulness cannot ask, because decomposing an "
                 "answer into independently-supported statements is blind to reversed causality "
                 "and other relational errors. No gate is added; Ragas faithfulness is unchanged.")
    lines.append("")
    lines.append("Grounded correctness is reported separately from responsiveness. This evaluator "
                 "judges grounding only; a grounded but non-responsive answer is still grounded.")
    lines.append("")

    lines.append("## Case distribution")
    lines.append("")
    for name, tally in counts.items():
        rendered = ", ".join(f"`{k}` {v}" for k, v in tally.items())
        lines.append(f"- **{name}** — {rendered}")
    lines.append("")

    lines.append("## Agreement with binary human labels")
    lines.append("")
    lines.append("Positive class: `faithful` (verdict `supported`). `partially_supported` and "
                 "`unsupported` both map to `unfaithful` per the label contract. Prediction = the "
                 "per-case majority verdict across replicates; cases with fewer than two usable "
                 "verdicts are excluded as insufficient data.")
    lines.append("")
    lines.append("| judge | pos | neg | pos recall | neg recall | FPR | FNR | balanced acc | insufficient | missing-result rate |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|")
    for judge in judges:
        r = by_judge[judge]
        lines.append(
            f"| `{judge}` | {r['positives']} | {r['negatives']} | {r['positive_recall']} | "
            f"{r['negative_recall']} | {r['false_positive_rate']} | {r['false_negative_rate']} | "
            f"{r['balanced_accuracy']} | {r['insufficient_data']} | {r['missing_result_rate']} |"
        )
    lines.append("")
    lines.append("Negative recall is the headline: it is the share of genuinely unfaithful answers "
                 "the evaluator caught. A high false-positive rate means unfaithful answers were "
                 "waved through.")
    lines.append("")

    lines.append("## Relational-failure detection")
    lines.append("")
    lines.append("Detection = the mutated (unfaithful) case was predicted unfaithful. Denominator "
                 "excludes cases left insufficient.")
    lines.append("")
    lines.append("| judge | relational inversion | wrong number | added claim |")
    lines.append("|---|---|---|---|")
    for judge in judges:
        r = by_judge[judge]
        lines.append(f"| `{judge}` | {r['relational_inversion_detected']} | "
                     f"{r['wrong_number_detected']} | {r['added_claim_detected']} |")
    lines.append("")
    lines.append("The two `reverse_causal` cases are the exact blind spot documented for Ragas "
                 "faithfulness on this set: same words, opposite direction of causation.")
    lines.append("")

    lines.append("## Verdict distribution and partial support")
    lines.append("")
    lines.append("Partial support is reported separately: it maps to unfaithful, but a judge that "
                 "leans on it behaves differently from one that commits to `unsupported`.")
    lines.append("")
    lines.append("| judge | supported | partially_supported | unsupported | insufficient_data |")
    lines.append("|---|---|---|---|---|")
    for judge in judges:
        r = by_judge[judge]
        lines.append(f"| `{judge}` | {r['n_supported']} | {r['n_partially_supported']} | "
                     f"{r['n_unsupported']} | {r['n_insufficient']} |")
    lines.append("")

    lines.append("## Stability and confidence calibration")
    lines.append("")
    lines.append("| judge | run-to-run verdict agreement | unanimous cases | mean confidence (correct) | mean confidence (incorrect) |")
    lines.append("|---|---|---|---|---|")
    for judge in judges:
        r = by_judge[judge]
        lines.append(f"| `{judge}` | {r['verdict_agreement']} | {r['unanimous_cases']} | "
                     f"{r['mean_conf_correct']} | {r['mean_conf_incorrect']} |")
    lines.append("")
    lines.append("Run-to-run verdict agreement is the modal-verdict share across replicates. A "
                 "well-calibrated judge is more confident when it is right than when it is wrong.")
    lines.append("")

    if ragas:
        lines.append("## Comparison with retained Ragas faithfulness")
        lines.append("")
        lines.append("Same 24 cases, same judges. Ragas faithfulness thresholded at 0.5 on its "
                     "retained observations; relational evaluator uses the majority verdict.")
        lines.append("")
        lines.append("| judge | metric | neg recall (catches unfaithful) | FPR (waves through) | balanced acc |")
        lines.append("|---|---|---|---|---|")
        for judge in judges:
            rel = build_confusion(records, cases_by_key, judge=judge)
            lines.append(f"| `{judge}` | relational | {_pct(rel.negative_recall)} | "
                         f"{_pct(rel.false_positive_rate)} | {_pct(rel.balanced_accuracy)} |")
            entry = ragas.get(judge)
            if entry is not None:
                matrix, used, _skipped = entry
                lines.append(f"| `{judge}` | ragas faithfulness ({used} cases) | "
                             f"{_pct(matrix.negative_recall)} | {_pct(matrix.false_positive_rate)} | "
                             f"{_pct(matrix.balanced_accuracy)} |")
        lines.append("")

    lines.append("## Assessment")
    lines.append("")
    for judge in judges:
        r = by_judge[judge]
        inv = r["relational_inversion_detected"]
        lines.append(f"- `{judge}`: relational inversions detected {inv}; negative recall "
                     f"{r['negative_recall']}; balanced accuracy {r['balanced_accuracy']}; "
                     f"run-to-run agreement {r['verdict_agreement']}; missing-result rate "
                     f"{r['missing_result_rate']}.")
    lines.append("")
    lines.append("Read against the questions this set exists to answer: does it detect both "
                 "relational inversions; does it reduce false positives on unfaithful answers "
                 "versus Ragas faithfulness; does it preserve recall on faithful answers; which "
                 "judge is better; is it stable enough for diagnostic use; is it strong enough for "
                 "a regression gate. The numeric answers are in the tables above.")
    lines.append("")

    lines.append("## Methodological limitations")
    lines.append("")
    lines.append(f"Small sample ({len(cases)} cases), selected to cover known failure modes rather "
                 "than sampled to estimate production prevalence, so confidence intervals would "
                 "overstate what it establishes. This is exploratory, not held-out validation.")
    lines.append("")
    lines.append("Insufficient-data and missing-result accounting is reported alongside every "
                 "recall so a judge that mostly failed to return a usable verdict cannot read as "
                 "accurate. Missing replicates are excluded from the confusion matrix, not "
                 "silently treated as a classification.")
    lines.append("")
    lines.append("A single call is a single sample of a stochastic judge; the Kimi judge cannot be "
                 "pinned below temperature 0.6, so its run-to-run verdict agreement is the ceiling "
                 "on how reproducible any single verdict is. Grounded correctness stays separate "
                 "from responsiveness; a topical but fabricated answer is caught here, an accurate "
                 "but non-responsive answer is not penalised for grounding.")
    lines.append("")

    lines.append("## Per-case detail")
    lines.append("")
    grouped = {judge: _group_by_case(records, judge) for judge in judges}
    lines.append("| case | doc:row | mutation | expected faith | " + " | ".join(judges) + " |")
    lines.append("|---|---|---|---|" + "---|" * len(judges))
    for case in sorted(cases, key=lambda c: c.case_id):
        cells = []
        for judge in judges:
            verdict, conf = _modal_verdict(grouped[judge].get((case.doc, case.case_id), []))
            cells.append(f"{verdict}" + (f" ({conf:.2f})" if conf is not None else ""))
        lines.append(
            f"| {case.case_id} | `{case.doc}:{case.source_row}` | {case.mutation} | "
            f"{case.expected_faithfulness} | " + " | ".join(cells) + " |"
        )
    lines.append("")
    lines.append(f"Raw observations: {len(records)} individual verdicts.")
    lines.append("")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def estimate_llm_calls(*, cases: int, judges: int, repeats: int) -> int:
    """One structured call per (case, judge, replicate)."""
    return cases * judges * repeats


def main(argv: Optional[list[str]] = None, *, evaluate: Optional[EvaluateFn] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Score the balanced calibration cases with the relation-aware evaluator."
    )
    parser.add_argument("--cases", type=Path, default=CASES_PATH)
    parser.add_argument("--judges", default=DEFAULT_JUDGES)
    parser.add_argument("--repeats", type=int, default=DEFAULT_REPEATS)
    parser.add_argument("--baseline-dir", type=Path, default=RESULTS_DIR,
                        help="Directory of saved run_ragas result CSVs (read-only).")
    parser.add_argument("--ragas-observations", type=Path, default=None,
                        help="Retained Ragas observations CSV to compare against (optional).")
    parser.add_argument("--out-dir", type=Path, default=RELATIONAL_OUTPUT_DIR,
                        help="Defaults to the gitignored run directory.")
    parser.add_argument("--tag", default="")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate cases and print the plan. No judge calls.")
    parser.add_argument("--replay", type=Path, default=None,
                        help="Rebuild the report from a saved records CSV. No judge calls.")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        judges = tuple(j.strip() for j in args.judges.split(",") if j.strip())
        if not judges:
            raise CalibrationError("No judges selected.")
        if args.repeats < MIN_REPLICATES:
            raise CalibrationError(
                f"--repeats must be >= {MIN_REPLICATES} to measure run-to-run agreement, "
                f"got {args.repeats}."
            )

        cases = load_cases(args.cases)
        materialised = materialise_cases(cases, baseline_dir=args.baseline_dir)

        if args.dry_run:
            print(f"cases    : {len(cases)} (validated + materialised)")
            print(f"judges   : {', '.join(judges)}")
            print(f"repeats  : {args.repeats}")
            print(f"estimated judge LLM calls: "
                  f"{estimate_llm_calls(cases=len(cases), judges=len(judges), repeats=args.repeats)}")
            print("dry run — no API calls made, no files written.")
            return 0

        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        suffix = f"_{args.tag}" if args.tag else ""
        raw_items: list[dict] = []

        if args.replay:
            records = read_records_csv(args.replay)
            if not records:
                raise CalibrationError(f"{args.replay} holds no records.")
            judges = tuple(dict.fromkeys(r.judge for r in records))
            repeats = max((r.replicate for r in records), default=args.repeats)
            logger.info("Replaying %d records from %s", len(records), args.replay.name)
        else:
            repeats = args.repeats
            records = run_relational_cases(
                materialised, judges=judges, repeats=repeats, evaluate=evaluate, raw_out=raw_items
            )

        cases_by_key = {(c.doc, c.case_id): c for c in cases}
        ragas: Optional[dict[str, tuple[ConfusionMatrix, int, int]]] = None
        if args.ragas_observations:
            ragas = {}
            for judge in judges:
                try:
                    ragas[judge] = ragas_faithfulness_confusion(
                        args.ragas_observations, cases_by_key, judge=judge
                    )
                except (CalibrationError, KeyError) as exc:
                    logger.warning("skipping Ragas comparison for %s: %s", judge, exc)

        obs_path = write_records_csv(records, args.out_dir / f"relational_observations{suffix}_{stamp}.csv")
        metric_rows = build_metric_rows(records, cases_by_key, judges=judges)
        metrics_path = write_metrics_csv(metric_rows, args.out_dir / f"relational_metrics{suffix}_{stamp}.csv")
        report = build_report(
            records=records, cases=cases, judges=judges, repeats=repeats,
            generated_at=stamp, ragas=ragas,
        )
        report_path = args.out_dir / f"relational_grounded{suffix}_{stamp}.md"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report, encoding="utf-8")

        logger.info("Wrote %s", obs_path)
        logger.info("Wrote %s", metrics_path)
        if raw_items:
            raw_path = write_raw_jsonl(raw_items, args.out_dir / f"relational_raw{suffix}_{stamp}.jsonl")
            logger.info("Wrote %s (local debug only — gitignored)", raw_path)
        logger.info("Wrote %s", report_path)
        print(report)
        return 0
    except CalibrationError as exc:
        logger.error("%s", exc)
        return 1
    except Exception:
        logger.exception("Relational agreement run failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
