"""Versioned calibration cases — balanced positive/negative judge probes.

The six-row label set that shipped with the calibration harness contained only
fully-faithful answers. A judge that called *everything* faithful would have
scored perfectly against it, so it could measure a judge's false-negative rate
and nothing else. This module defines a balanced set that can measure both
directions.

Design
------
A case is **not** a hand-written answer. It is a deterministic *mutation* of an
answer the pipeline really produced, applied to the contexts that answer was
really generated from. That keeps the negatives realistic (they are the failure
modes the system actually exhibits) and keeps the human label defensible (the
mutation defines exactly what changed and why the label follows).

What is committed vs. what is local
-----------------------------------
Committed (``calibration_cases.json``): document + baseline row identifiers,
mutation instructions, expected labels, short original-wording rationales, and
**hashes** of the source question and answer. Never the question, the answer,
or any retrieved context — those derive from third-party PDFs.

Local (materialised at run time): the full case, reconstructed from the
gitignored baseline CSVs. ``materialise_cases`` fails loudly when a source row
is missing or when its text no longer matches the committed hash, so a case can
never be silently scored against different inputs than it was labelled for.

Labels
------
``expected_faithfulness`` is **binary**:

``faithful``
    Every claim in the answer is supported by the retrieved contexts.
``unfaithful``
    At least one claim is not supported by, or contradicts, the contexts.

No fractional ground truth is asserted. Ragas returns a continuous score whose
denominator is however many statements its own splitter produced, which is not
a quantity a human labelled — so comparing against a fraction would be
comparing against an artefact of the metric rather than against the truth.

``expected_quality`` is separate and ordinal:

``responsive``
    Addresses what was asked. Says nothing about whether the answer is correct:
    a confidently wrong answer is still responsive.
``partially_responsive``
    Addresses part of a multi-part request, omits the rest.
``non_responsive``
    Does not address the request, however true the content may be.

Run (from ``backend/``)::

    python -m evals.calibration_cases --validate
    python -m evals.calibration_cases --summary
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, Sequence

from evals.calibrate import (
    BaselineRow,
    CalibrationError,
    load_baseline_rows,
    RESULTS_DIR,
)

logger = logging.getLogger("evals.calibration_cases")

EVAL_DIR = Path(__file__).resolve().parent
CASES_PATH = EVAL_DIR / "calibration_cases.json"

SCHEMA_VERSION = 1

FAITHFUL = "faithful"
UNFAITHFUL = "unfaithful"
FAITHFULNESS_LABELS = (FAITHFUL, UNFAITHFUL)

RESPONSIVE = "responsive"
PARTIALLY_RESPONSIVE = "partially_responsive"
NON_RESPONSIVE = "non_responsive"
QUALITY_LABELS = (RESPONSIVE, PARTIALLY_RESPONSIVE, NON_RESPONSIVE)

#: Mutation vocabulary. Each entry maps to a handler in ``_MUTATORS``.
MUTATION_TYPES = (
    "identity",              # unchanged answer — positive control
    "append_claim",          # add one unsupported claim
    "combine",               # keep one supported sentence + one unsupported claim
    "replace_number",        # swap a correct number/entity for a wrong one
    "reverse_causal",        # reverse a causal relationship
    "drop_sentence",         # remove a required part, keep the answering part
    "evade_request",         # keep only non-answering facts — request unanswered
    "swap_question",         # pair the answer with a neighbouring question
    "fabricate",             # wholly invented answer
)

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
#: Numbers as a human reads them: ``10,000`` and ``3.5`` are each one token.
_NUMBER_TOKEN = re.compile(r"\d[\d,\.]*")


class CaseError(CalibrationError):
    """A case definition is invalid, or cannot be materialised from a baseline."""


@dataclass(frozen=True)
class CalibrationCase:
    """One committed case definition. Holds no source text — only identifiers."""

    case_id: int
    doc: str
    source_row: int
    mutation: str
    params: dict[str, Any]
    expected_faithfulness: str
    expected_quality: str
    rationale: str
    question_sha: str
    answer_sha: str
    concept_label: str = ""
    question_from_row: Optional[int] = None
    question_from_sha: Optional[str] = None

    @property
    def key(self) -> str:
        return f"{self.doc}:case{self.case_id}"

    def source_rows(self) -> tuple[int, ...]:
        """Baseline rows this case needs materialised."""
        if self.question_from_row is None:
            return (self.source_row,)
        return (self.source_row, self.question_from_row)


@dataclass(frozen=True)
class MaterialisedCase:
    """A case joined to its baseline text. Local only — never serialised."""

    case: CalibrationCase
    row: BaselineRow = field(repr=False)

    def as_scoring_row(self) -> BaselineRow:
        """The row handed to the judge: mutated answer, possibly swapped question.

        ``row_index`` carries ``case_id`` rather than the baseline row number so
        two cases derived from the same source row aggregate separately instead
        of colliding in one bucket.
        """
        return self.row


def text_sha(text: str) -> str:
    """Short stable digest of normalised text. Committing this, never the text."""
    normalised = re.sub(r"\s+", " ", text or "").strip()
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()[:16]


def split_sentences(text: str) -> list[str]:
    return [s for s in _SENTENCE_SPLIT.split((text or "").strip()) if s]


# --------------------------------------------------------------------------
# Mutations — every one is a pure function of (text, params)
# --------------------------------------------------------------------------


def _mutate_identity(answer: str, _params: dict, _ctx: dict) -> str:
    return answer


def _mutate_append_claim(answer: str, params: dict, _ctx: dict) -> str:
    return f"{answer.rstrip()} {params['text'].strip()}"


def _mutate_combine(answer: str, params: dict, _ctx: dict) -> str:
    kept = _keep(answer, params["keep"])
    return f"{kept} {params['text'].strip()}"


def _mutate_replace_number(answer: str, params: dict, _ctx: dict) -> str:
    occurrence = int(params["occurrence"])
    matches = list(_NUMBER_TOKEN.finditer(answer))
    if occurrence < 1 or occurrence > len(matches):
        raise CaseError(
            f"replace_number wants occurrence {occurrence} but the answer has "
            f"{len(matches)} number token(s)."
        )
    match = matches[occurrence - 1]
    return answer[: match.start()] + str(params["replacement"]) + answer[match.end():]


def _mutate_reverse_causal(answer: str, params: dict, _ctx: dict) -> str:
    """Swap the clauses either side of a causal connective.

    ``X because Y`` becomes ``Y because X`` — the same words, asserting the
    opposite direction of causation, which the contexts do not support.
    """
    connective = params.get("connective", "because")
    sentences = split_sentences(answer)
    marker = f" {connective} "
    candidates = [index for index, sentence in enumerate(sentences) if marker in sentence]
    if not candidates:
        raise CaseError(f"reverse_causal found no {connective!r} clause to reverse.")
    if len(candidates) != 1:
        raise CaseError(
            f"reverse_causal is ambiguous: found {len(candidates)} "
            f"{connective!r} clauses; expected exactly one."
        )

    index = candidates[0]
    head, _, tail = sentences[index].partition(marker)
    tail = tail.rstrip()
    trailing = ""
    if tail and tail[-1] in ".!?":
        tail, trailing = tail[:-1], tail[-1]
    swapped = f"{_capitalise(tail)}{marker}{_decapitalise(head)}{trailing or '.'}"
    sentences[index] = swapped
    return " ".join(sentences)


def _mutate_drop_sentence(answer: str, params: dict, _ctx: dict) -> str:
    return _keep(answer, params["keep"])


def _mutate_evade_request(answer: str, params: dict, _ctx: dict) -> str:
    return _keep(answer, params["keep"])


def _mutate_swap_question(answer: str, _params: dict, _ctx: dict) -> str:
    return answer  # the question moves, not the answer


def _mutate_fabricate(_answer: str, params: dict, _ctx: dict) -> str:
    return params["text"].strip()


_MUTATORS = {
    "identity": _mutate_identity,
    "append_claim": _mutate_append_claim,
    "combine": _mutate_combine,
    "replace_number": _mutate_replace_number,
    "reverse_causal": _mutate_reverse_causal,
    "drop_sentence": _mutate_drop_sentence,
    "evade_request": _mutate_evade_request,
    "swap_question": _mutate_swap_question,
    "fabricate": _mutate_fabricate,
}


def _keep(answer: str, indices: Sequence[int]) -> str:
    sentences = split_sentences(answer)
    missing = [i for i in indices if i < 0 or i >= len(sentences)]
    if missing:
        raise CaseError(
            f"keep index/indices {missing} out of range — answer has "
            f"{len(sentences)} sentence(s)."
        )
    return " ".join(sentences[i] for i in indices)


def _capitalise(text: str) -> str:
    return text[:1].upper() + text[1:] if text else text


def _decapitalise(text: str) -> str:
    # Leave acronyms and proper nouns alone: only fold a lone leading capital.
    if len(text) > 1 and text[0].isupper() and not text[1].isupper():
        return text[0].lower() + text[1:]
    return text


def apply_mutation(case: CalibrationCase, answer: str) -> str:
    """Apply ``case``'s mutation to ``answer``. Pure and deterministic."""
    try:
        mutator = _MUTATORS[case.mutation]
    except KeyError as exc:
        raise CaseError(
            f"case {case.case_id}: unknown mutation {case.mutation!r}. "
            f"Known: {', '.join(sorted(_MUTATORS))}."
        ) from exc
    return mutator(answer, case.params, {})


# --------------------------------------------------------------------------
# Loading + validation
# --------------------------------------------------------------------------


def load_cases(path: Path = CASES_PATH) -> list[CalibrationCase]:
    """Read and structurally validate the committed case definitions."""
    if not path.exists():
        raise CaseError(f"No calibration cases at {path}.")
    raw = json.loads(path.read_text())

    version = raw.get("schema_version")
    if version != SCHEMA_VERSION:
        raise CaseError(
            f"{path.name} declares schema_version {version!r}, this code expects "
            f"{SCHEMA_VERSION}."
        )

    cases: list[CalibrationCase] = []
    seen_ids: set[int] = set()
    for entry in raw.get("cases", []):
        case_id = entry.get("case_id")
        if case_id in seen_ids:
            raise CaseError(f"duplicate case_id {case_id}.")
        seen_ids.add(case_id)

        if entry["mutation"] not in MUTATION_TYPES:
            raise CaseError(
                f"case {case_id}: mutation {entry['mutation']!r} is not in the "
                f"declared vocabulary {MUTATION_TYPES}."
            )
        if entry["expected_faithfulness"] not in FAITHFULNESS_LABELS:
            raise CaseError(
                f"case {case_id}: expected_faithfulness must be one of "
                f"{FAITHFULNESS_LABELS}."
            )
        if entry["expected_quality"] not in QUALITY_LABELS:
            raise CaseError(
                f"case {case_id}: expected_quality must be one of {QUALITY_LABELS}."
            )
        if not entry.get("rationale", "").strip():
            raise CaseError(f"case {case_id}: rationale is required.")
        if entry.get("question_from_row") is not None and not entry.get("question_from_sha"):
            raise CaseError(
                f"case {case_id}: question_from_sha is required when question_from_row is set."
            )

        cases.append(
            CalibrationCase(
                case_id=case_id,
                doc=entry["doc"],
                source_row=entry["source_row"],
                mutation=entry["mutation"],
                params=entry.get("params", {}),
                expected_faithfulness=entry["expected_faithfulness"],
                expected_quality=entry["expected_quality"],
                rationale=entry["rationale"],
                question_sha=entry["question_sha"],
                answer_sha=entry["answer_sha"],
                concept_label=entry.get("concept_label", ""),
                question_from_row=entry.get("question_from_row"),
                question_from_sha=entry.get("question_from_sha"),
            )
        )
    if not cases:
        raise CaseError(f"{path.name} defines no cases.")
    return cases


def materialise_cases(
    cases: Sequence[CalibrationCase], *, baseline_dir: Path = RESULTS_DIR
) -> list[MaterialisedCase]:
    """Join case definitions to baseline text. Read-only; no network.

    Fails loudly rather than silently scoring the wrong thing:
    - the source row must exist in a baseline CSV;
    - its question and answer must still hash to the committed values.
    """
    wanted: dict[str, set[int]] = {}
    for case in cases:
        wanted.setdefault(case.doc, set()).update(case.source_rows())

    rows_by_doc: dict[str, dict[int, BaselineRow]] = {}
    for doc, indexes in wanted.items():
        ordered = sorted(indexes)
        try:
            loaded = load_baseline_rows(doc, ordered, baseline_dir=baseline_dir)
        except CalibrationError as exc:
            raise CaseError(
                f"cannot materialise cases for {doc!r}: {exc}"
            ) from exc
        rows_by_doc[doc] = {row.row_index: row for row in loaded}

    materialised: list[MaterialisedCase] = []
    for case in cases:
        source = rows_by_doc[case.doc].get(case.source_row)
        if source is None:
            raise CaseError(
                f"case {case.case_id}: baseline row {case.doc}:{case.source_row} not found."
            )

        actual_q, actual_a = text_sha(source.question), text_sha(source.answer)
        if actual_q != case.question_sha:
            raise CaseError(
                f"case {case.case_id}: baseline question for {case.doc}:{case.source_row} "
                f"changed (committed {case.question_sha}, found {actual_q}). The case was "
                f"labelled against different text — re-verify it by hand before re-hashing."
            )
        if actual_a != case.answer_sha:
            raise CaseError(
                f"case {case.case_id}: baseline answer for {case.doc}:{case.source_row} "
                f"changed (committed {case.answer_sha}, found {actual_a}). The mutation and "
                f"its label were derived from the old answer — re-verify by hand."
            )

        question = source.question
        if case.question_from_row is not None:
            neighbour = rows_by_doc[case.doc].get(case.question_from_row)
            if neighbour is None:
                raise CaseError(
                    f"case {case.case_id}: question_from_row "
                    f"{case.doc}:{case.question_from_row} not found."
                )
            actual_swapped_q = text_sha(neighbour.question)
            if actual_swapped_q != case.question_from_sha:
                raise CaseError(
                    f"case {case.case_id}: swapped question for "
                    f"{case.doc}:{case.question_from_row} changed "
                    f"(committed {case.question_from_sha}, found {actual_swapped_q}). "
                    "The responsiveness label was derived from the old question — "
                    "re-verify it by hand before re-hashing."
                )
            question = neighbour.question

        materialised.append(
            MaterialisedCase(
                case=case,
                row=BaselineRow(
                    doc=case.doc,
                    row_index=case.case_id,
                    question=question,
                    answer=apply_mutation(case, source.answer),
                    reference=source.reference,
                    contexts=source.contexts,
                    concept_label=case.concept_label or source.concept_label,
                    source_csv=source.source_csv,
                ),
            )
        )
    return materialised


def distribution(cases: Sequence[CalibrationCase]) -> dict[str, dict[str, int]]:
    """Counts by label and mutation — used by --summary and by tests."""
    def tally(values):
        counts: dict[str, int] = {}
        for value in values:
            counts[value] = counts.get(value, 0) + 1
        return dict(sorted(counts.items()))

    return {
        "faithfulness": tally(c.expected_faithfulness for c in cases),
        "quality": tally(c.expected_quality for c in cases),
        "mutation": tally(c.mutation for c in cases),
        "doc": tally(c.doc for c in cases),
    }


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate and summarise the calibration case set. No network, no judge."
    )
    parser.add_argument("--cases", type=Path, default=CASES_PATH)
    parser.add_argument("--baseline-dir", type=Path, default=RESULTS_DIR,
                        help="Directory of saved run_ragas result CSVs (read-only).")
    parser.add_argument("--validate", action="store_true",
                        help="Materialise every case from the baselines and check hashes.")
    parser.add_argument("--summary", action="store_true",
                        help="Print the label/mutation distribution.")
    parser.add_argument("--show", type=int, default=None, metavar="CASE_ID",
                        help="Print one materialised case locally. Never write this to a "
                             "committed file — it contains source-derived text.")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        cases = load_cases(args.cases)
        if args.summary or not (args.validate or args.show):
            counts = distribution(cases)
            print(f"{len(cases)} cases, schema v{SCHEMA_VERSION}")
            for name, tally in counts.items():
                rendered = ", ".join(f"{k}={v}" for k, v in tally.items())
                print(f"  {name:<14} {rendered}")

        if args.validate or args.show is not None:
            materialised = materialise_cases(cases, baseline_dir=args.baseline_dir)
            print(f"materialised {len(materialised)}/{len(cases)} cases — "
                  f"all source rows found, all hashes match")

            if args.show is not None:
                match = next(
                    (m for m in materialised if m.case.case_id == args.show), None
                )
                if match is None:
                    raise CaseError(f"no case with case_id {args.show}.")
                row, case = match.row, match.case
                print(f"\ncase {case.case_id} [{case.doc}:{case.source_row}] "
                      f"{case.mutation} -> {case.expected_faithfulness} / "
                      f"{case.expected_quality}")
                print(f"rationale: {case.rationale}")
                print(f"\nQ: {row.question}\n\nA: {row.answer}\n")
                print(f"({len(row.contexts)} contexts withheld from stdout)")
        return 0
    except CaseError as exc:
        logger.error("%s", exc)
        return 1
    except CalibrationError as exc:
        logger.error("%s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
