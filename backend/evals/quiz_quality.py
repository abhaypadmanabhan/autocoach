"""Quiz-quality eval: does a generated question hold up against its source?

The Ragas harness scores retrieval + a synthetic answer. This one scores the
thing the learner actually sees. For each concept of a document it generates a
question through the real ``generate_single_question`` path and checks it:

* structural checks (pure string logic): four distinct options, a key that
  names one of them, no "all of the above";
* open-book solver: a different-family model, given only the passages the
  generator saw, must pick the key (for free text: must find the reference
  answer supported). It also returns a quote, which must appear verbatim in
  those passages (a string check, not a judge opinion);
* closed-book solver: the same model without the passages. A question it can
  answer cold is guessable and teaches nothing about the document.

Headline numbers: completion, validity, evidence-hit and closed-book guess
rates, generation p50 latency and cost per five-question quiz.

Generation modes (``--modes``) match the two paths a session uses:
``background`` (default; questions 2+, verified by the free checks and the
blind solver) and ``q1`` (the synchronous first question: free checks only,
plus the solver when ``QUIZ_VERIFY_FIRST_QUESTION`` is on). Run both to
compare them side by side.

Three ways to run it::

    # live (costs money; needs a spend ledger, see below)
    python -m evals.quiz_quality --doc all --per-doc 30 --label baseline
    # re-score a recorded run, no network
    python -m evals.quiz_quality --replay evals/results/quiz_quality_x.jsonl
    # as a gate: exit 1 when a threshold is missed
    python -m evals.quiz_quality --replay <file> --gate

A live run refuses to start unless ``LLM_SPEND_LEDGER_PATH`` is set, so every
call it makes is counted (and capped by ``LLM_SPEND_CAP_USD``).

The question checks are shared with the generator
(``app.services.question_checks``, pure string logic). Other app imports are
lazy: scoring and replay need no keys and no network.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import statistics
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from app.services.question_checks import (
    LETTERS,
    SOLVER_SYSTEM as _SOLVER_SYSTEM,
    answer_spec,
    expected_answer,
    key_letter,
    option_text,
    parse_solver_reply,
    question_stem,
    quote_in_context,
    solver_task,
    structural_problems,
)
from evals.config import GOLDEN_DIR, load_config

logger = logging.getLogger(__name__)

RESULTS_DIR = Path(__file__).resolve().parent / "results"

#: Solver and judge of record. A different family from the generator
#: (DeepSeek), so the two do not share blind spots. $0.10 in / $0.50 out per
#: million tokens on OpenRouter (2026-11-22), under the routing price ceiling.
SOLVER_MODEL = "openai/gpt-6-luna"

#: Requested type per generated question, cycled. Half MCQ, like a session.
TYPE_CYCLE = ("text_mcq", "text_tf", "text_mcq", "text_free")

QUESTIONS_PER_QUIZ = 5
#: A key more than this many times longer than the average distractor (and at
#: least 25 characters longer) is a giveaway: "pick the long one".
KEY_LENGTH_RATIO = 1.8
KEY_LENGTH_MIN_GAP = 25

#: Gate thresholds. Guess rate is over MCQ + true/false, where blind chance
#: alone is roughly 0.35, so the ceiling is loose on purpose.
DEFAULT_THRESHOLDS = {
    "min_completion_rate": 0.90,
    "min_validity_rate": 0.90,
    "min_evidence_hit_rate": 0.80,
    "max_guess_rate": 0.65,
}



# --------------------------------------------------------------------------
# pure scoring
# --------------------------------------------------------------------------


def key_length_outlier(question: dict) -> bool:
    """True when the keyed MCQ option is conspicuously the longest."""
    if question.get("question_type") != "text_mcq":
        return False
    letter = key_letter(question)
    options = [option_text(o) for o in (question.get("options") or [])]
    if letter is None or len(options) != 4:
        return False
    key_len = len(options[LETTERS.index(letter)])
    others = [len(o) for i, o in enumerate(options) if i != LETTERS.index(letter)]
    mean_other = sum(others) / len(others)
    return key_len > KEY_LENGTH_RATIO * mean_other and key_len - mean_other >= KEY_LENGTH_MIN_GAP


def score_row(raw: dict) -> dict:
    """Score one recorded generation attempt. Pure: same input, same output."""
    question = raw.get("question")
    scored = {
        "doc": raw.get("doc"),
        "concept_name": raw.get("concept_name"),
        "requested_type": raw.get("requested_type"),
        "mode": raw.get("mode") or "default",
        "latency_s": raw.get("latency_s"),
        "gen_cost_usd": raw.get("gen_cost_usd"),
        "completed": bool(question),
    }
    if not question:
        return scored

    context = [c.get("content", "") for c in (question.get("context_chunks") or [])]
    problems = structural_problems(question)
    expected = expected_answer(question)
    open_book = raw.get("open_book")
    closed_book = raw.get("closed_book")
    selectable = question.get("question_type") in {"text_mcq", "text_tf"}

    scored.update(
        question_type=question.get("question_type"),
        problems=problems,
        key_length_outlier=key_length_outlier(question),
        solver_ran=open_book is not None,
        solver_agrees=bool(open_book) and expected is not None and open_book.get("answer") == expected,
        evidence_hit=bool(open_book) and quote_in_context(open_book.get("quote"), context),
        guessable=(
            None
            if not selectable or closed_book is None
            else expected is not None and closed_book.get("answer") == expected
        ),
        source_quote_verbatim=(
            quote_in_context(question["source_quote"], context)
            if question.get("source_quote")
            else None
        ),
    )
    scored["valid"] = not problems and scored["solver_agrees"]
    return scored


def _rate(hits: int, total: int) -> Optional[float]:
    return round(hits / total, 4) if total else None


def _p50(values: list[float]) -> Optional[float]:
    return round(statistics.median(values), 3) if values else None


def summarize(scored_rows: list[dict]) -> dict:
    """Headline numbers over scored rows (one mode, any number of docs)."""
    completed = [r for r in scored_rows if r["completed"]]
    judged = [r for r in completed if r["solver_ran"]]
    selectable = [r for r in completed if r.get("guessable") is not None]
    mcq = [r for r in selectable if r.get("question_type") == "text_mcq"]
    quoted = [r for r in completed if r.get("source_quote_verbatim") is not None]
    costs = [r["gen_cost_usd"] for r in scored_rows if r.get("gen_cost_usd") is not None]
    return {
        "attempted": len(scored_rows),
        "completed": len(completed),
        "completion_rate": _rate(len(completed), len(scored_rows)),
        "validity_rate": _rate(sum(r["valid"] for r in judged), len(judged)),
        "structural_defect_rate": _rate(sum(bool(r["problems"]) for r in completed), len(completed)),
        "evidence_hit_rate": _rate(sum(r["evidence_hit"] for r in judged), len(judged)),
        "guess_rate": _rate(sum(r["guessable"] for r in selectable), len(selectable)),
        "guess_rate_mcq": _rate(sum(r["guessable"] for r in mcq), len(mcq)),
        "key_length_outlier_rate": _rate(sum(r["key_length_outlier"] for r in mcq), len(mcq)),
        "source_quote_verbatim_rate": _rate(
            sum(r["source_quote_verbatim"] for r in quoted), len(quoted)
        ),
        "solver_errors": len(completed) - len(judged),
        "p50_latency_s": _p50([r["latency_s"] for r in completed if r.get("latency_s") is not None]),
        "cost_per_quiz_usd": (
            round(sum(costs) / len(costs) * QUESTIONS_PER_QUIZ, 5) if costs else None
        ),
    }


def summarize_by_mode(scored_rows: list[dict]) -> dict[str, dict]:
    modes = sorted({r["mode"] for r in scored_rows})
    return {mode: summarize([r for r in scored_rows if r["mode"] == mode]) for mode in modes}


def gate_failures(summary: dict, thresholds: dict = DEFAULT_THRESHOLDS) -> list[str]:
    """Human-readable threshold misses. A metric that could not be computed
    (no rows to compute it from) is a failure, never a silent pass."""
    failures = []
    for name, limit in thresholds.items():
        bound, metric = name.split("_", 1)
        value = summary.get(metric)
        if value is None:
            failures.append(f"{metric}: no data")
        elif bound == "min" and value < limit:
            failures.append(f"{metric} {value:.3f} < {limit:.2f}")
        elif bound == "max" and value > limit:
            failures.append(f"{metric} {value:.3f} > {limit:.2f}")
    return failures


# --------------------------------------------------------------------------
# solver prompts
# --------------------------------------------------------------------------



def open_book_prompt(question: dict) -> str:
    passages = "\n\n".join(
        c.get("content", "") for c in (question.get("context_chunks") or [])
    )
    head = f"<passages>\n{passages}\n</passages>\n\n{question_stem(question)}\n\n"
    quote_rule = (
        '"quote": the one sentence from the passages that settles it, copied '
        'character for character (empty string if the passages do not settle it)'
    )
    return f"{head}{solver_task(question)}, {quote_rule}}}"


def closed_book_prompt(question: dict) -> str:
    return (
        f"{question_stem(question)}\n\nYou have no reference material. Give your best answer.\n"
        f"Reply as JSON: {{{answer_spec(question)}}}"
    )


# --------------------------------------------------------------------------
# live collection
# --------------------------------------------------------------------------

GenerateFn = Callable[[str, dict, str, str], Optional[dict]]
SolveFn = Callable[[str], str]


@dataclass(frozen=True)
class EvalDoc:
    slug: str
    document_id: str


def collect_row(
    doc: EvalDoc,
    concept: dict,
    requested_type: str,
    mode: str,
    *,
    generate: GenerateFn,
    solve: SolveFn,
    spend_total: Callable[[], float],
) -> dict:
    """Generate one question and gather the solver replies. No scoring here:
    the row is the recording that ``score_row`` and ``--replay`` work from."""
    spent_before = spend_total()
    started = time.perf_counter()
    question = generate(doc.document_id, concept, requested_type, mode)
    latency = round(time.perf_counter() - started, 3)
    raw: dict[str, Any] = {
        "doc": doc.slug,
        "concept_id": str(concept.get("id")),
        "concept_name": concept.get("concept_name"),
        "requested_type": requested_type,
        "mode": mode,
        "latency_s": latency,
        "gen_cost_usd": round(spend_total() - spent_before, 6),
        "question": question,
    }
    if not question:
        return raw
    raw["open_book"] = parse_solver_reply(solve(open_book_prompt(question)))
    if question.get("question_type") in {"text_mcq", "text_tf"}:
        raw["closed_book"] = parse_solver_reply(solve(closed_book_prompt(question)))
    return raw


def collect(
    docs: list[EvalDoc],
    *,
    per_doc: int,
    modes: list[str],
    load_concepts: Callable[[str], list[dict]],
    generate: GenerateFn,
    solve: SolveFn,
    spend_total: Callable[[], float],
    stop: Callable[[], bool] = lambda: False,
) -> list[dict]:
    """Rows for every doc x mode. Concepts and requested types are chosen
    deterministically, so a later run asks about the same concepts."""
    rows: list[dict] = []
    for doc in docs:
        concepts = load_concepts(doc.document_id)[:per_doc]
        if not concepts:
            logger.error("No concepts for %s (%s); skipping", doc.slug, doc.document_id)
            continue
        for mode in modes:
            for index, concept in enumerate(concepts):
                if stop():
                    logger.error("Spend cap reached; stopping with %d rows", len(rows))
                    return rows
                requested = TYPE_CYCLE[index % len(TYPE_CYCLE)]
                row = collect_row(
                    doc, concept, requested, mode,
                    generate=generate, solve=solve, spend_total=spend_total,
                )
                rows.append(row)
                logger.info(
                    "%s [%s] %d/%d %s -> %s",
                    doc.slug, mode, index + 1, len(concepts), requested,
                    "ok" if row["question"] else "no question",
                )
    return rows


def _live_load_concepts(document_id: str) -> list[dict]:
    from app.core.supabase import supabase_admin  # lazy: needs env

    res = (
        supabase_admin.table("concepts")
        .select("id, concept_name, concept_description, importance_score")
        .eq("document_id", document_id)
        .execute()
    )
    concepts = res.data or []
    concepts.sort(key=lambda c: (-float(c.get("importance_score") or 0), c.get("concept_name") or ""))
    return concepts


def _live_generate(document_id: str, concept: dict, requested_type: str, mode: str) -> Optional[dict]:
    from app.services.quiz_generator import generate_single_question  # lazy

    return generate_single_question(
        document_id=document_id,
        concept=concept,
        difficulty="medium",
        question_types=[requested_type],
        verify=(mode != "q1"),
    )


def _live_solver(model: str) -> SolveFn:
    def solve(prompt: str) -> str:
        from app.services.llm import call_kimi  # lazy

        return call_kimi(
            _SOLVER_SYSTEM,
            prompt,
            model=model,
            temperature=0,
            response_format={"type": "json_object"},
            max_tokens=400,
        )

    return solve


def rejudge(rows: list[dict], *, solve: SolveFn, stop: Callable[[], bool] = lambda: False) -> list[dict]:
    """The same recorded questions with fresh solver replies. Used to score a
    run with a judge that is NOT the model the generator verified against,
    so the generator is not marking its own homework."""
    out = []
    for row in rows:
        row = {k: v for k, v in row.items() if k not in {"open_book", "closed_book"}}
        question = row.get("question")
        if question and not stop():
            row["open_book"] = parse_solver_reply(solve(open_book_prompt(question)))
            if question.get("question_type") in {"text_mcq", "text_tf"}:
                row["closed_book"] = parse_solver_reply(solve(closed_book_prompt(question)))
        out.append(row)
    return out


# --------------------------------------------------------------------------
# io + cli
# --------------------------------------------------------------------------

_CSV_FIELDS = [
    "doc", "mode", "concept_name", "requested_type", "question_type", "completed",
    "valid", "problems", "solver_ran", "solver_agrees", "evidence_hit", "guessable",
    "key_length_outlier", "source_quote_verbatim", "latency_s", "gen_cost_usd",
]


def write_recording(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def read_recording(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def write_csv(scored_rows: list[dict], path: Path) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=_CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for row in scored_rows:
            writer.writerow({**row, "problems": ";".join(row.get("problems") or [])})


def format_table(summaries: dict[str, dict]) -> str:
    """Markdown table, one column per mode."""
    modes = list(summaries)
    metrics = list(next(iter(summaries.values()))) if summaries else []
    lines = ["| metric | " + " | ".join(modes) + " |", "|---|" + "---|" * len(modes)]
    for metric in metrics:
        cells = ["-" if summaries[m][metric] is None else str(summaries[m][metric]) for m in modes]
        lines.append(f"| {metric} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def _resolve_docs(doc_arg: str, document_ids: list[str], golden_dir: Path) -> list[EvalDoc]:
    docs = [EvalDoc(slug=f"doc-{d[:8]}", document_id=d) for d in document_ids]
    if doc_arg == "none":
        return docs
    slugs = (
        sorted(p.name.removesuffix(".config.json") for p in golden_dir.glob("*.config.json"))
        if doc_arg == "all"
        else [s.strip() for s in doc_arg.split(",") if s.strip()]
    )
    for slug in slugs:
        config = load_config(slug, golden_dir=golden_dir)
        docs.append(EvalDoc(slug=slug, document_id=config.document_id))
    return docs


def main(argv: Optional[list[str]] = None, *, golden_dir: Path = GOLDEN_DIR) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--doc", default="all", help="Golden slug(s), 'all' or 'none'.")
    parser.add_argument("--document-id", action="append", default=[],
                        help="Extra documents.id to evaluate (repeatable).")
    parser.add_argument("--per-doc", type=int, default=30, help="Questions per document.")
    parser.add_argument(
        "--modes",
        default="background",
        help="Comma-separated generation modes: 'background' (questions 2+: free checks "
        "and blind solver) and 'q1' (the synchronous first question: solver only when "
        "QUIZ_VERIFY_FIRST_QUESTION is on).",
    )
    parser.add_argument("--label", default="run", help="Tag for the output file names.")
    parser.add_argument("--replay", type=Path, help="Re-score a recorded .jsonl; no network.")
    parser.add_argument("--rejudge", type=Path,
                        help="Re-run only the solver on a recorded .jsonl (live; use with --solver-model).")
    parser.add_argument("--solver-model", default=SOLVER_MODEL,
                        help="OpenRouter model id for the open- and closed-book solver.")
    parser.add_argument("--gate", action="store_true", help="Exit 1 when a threshold is missed.")
    parser.add_argument("--out-dir", type=Path, default=RESULTS_DIR)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    if args.replay:
        rows = read_recording(args.replay)
    else:
        from app.config import get_settings  # lazy: needs env
        from app.services import llm  # lazy

        settings = get_settings()
        if not settings.llm_spend_ledger_path:
            print("Refusing a live run without LLM_SPEND_LEDGER_PATH: spend would be uncounted.",
                  file=sys.stderr)
            return 2
        cap = settings.llm_spend_cap_usd
        over_cap = lambda: cap > 0 and llm.spend_total() >= cap  # noqa: E731
        solve = _live_solver(args.solver_model)
        rows = rejudge(read_recording(args.rejudge), solve=solve, stop=over_cap) if args.rejudge else collect(
            _resolve_docs(args.doc, args.document_id, golden_dir),
            per_doc=args.per_doc,
            modes=[m.strip() for m in args.modes.split(",") if m.strip()],
            load_concepts=_live_load_concepts,
            generate=_live_generate,
            solve=solve,
            spend_total=llm.spend_total,
            stop=over_cap,
        )
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        recording = args.out_dir / f"quiz_quality_{args.label}_{stamp}.jsonl"
        write_recording(rows, recording)
        print(f"recording: {recording}")

    if not rows:
        print("No rows collected.", file=sys.stderr)
        return 2
    scored = [score_row(r) for r in rows]
    if not args.replay:
        csv_path = recording.with_suffix(".csv")
        write_csv(scored, csv_path)
        print(f"csv: {csv_path}")
    summaries = summarize_by_mode(scored)
    print(format_table(summaries))

    if args.gate:
        failed = False
        for mode, summary in summaries.items():
            for failure in gate_failures(summary):
                failed = True
                print(f"GATE FAIL [{mode}] {failure}", file=sys.stderr)
        if failed:
            return 1
        print("GATE PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
