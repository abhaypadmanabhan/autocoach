"""Ragas eval runner.

Loads a hand-curated golden JSONL, calls the LIVE retrieval path against
Qdrant, generates answers through Kimi, scores with Ragas (Kimi-as-judge),
and writes a per-row CSV plus stdout summary. Optionally uploads scores to
Langfuse Cloud.

Run:
    cd backend
    python -m evals.run_ragas --doc ddia
    python -m evals.run_ragas --doc all --limit 5
    python -m evals.run_ragas --doc ddia --no-langfuse

This script intentionally hits the same `retrieve_relevant_chunks` and
`call_kimi` the app uses, so eval results reflect production behavior.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import sys
from pathlib import Path

import pandas as pd
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    answer_relevancy,
    context_precision,
    context_recall,
    faithfulness,
)

from app.services.llm import call_kimi
from app.services.retrieval import retrieve_relevant_chunks
from evals.kimi_judge import build_judge_embeddings, build_judge_llm

logger = logging.getLogger("evals.run_ragas")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

EVAL_DIR = Path(__file__).resolve().parent
GOLDEN_DIR = EVAL_DIR / "golden"
RESULTS_DIR = EVAL_DIR / "results"

ANSWER_SYSTEM_PROMPT = (
    "You answer questions strictly from the provided context. "
    "If the context does not contain the answer, say so. "
    "Be concise — 1–3 sentences."
)


def _load_config(doc: str) -> dict:
    path = GOLDEN_DIR / f"{doc}.config.json"
    if not path.exists():
        raise FileNotFoundError(f"Missing config: {path}")
    return json.loads(path.read_text())


def _load_tuples(doc: str, limit: int | None) -> list[dict]:
    path = GOLDEN_DIR / f"{doc}.jsonl"
    if not path.exists():
        raise FileNotFoundError(f"Missing golden file: {path}")

    rows: list[dict] = []
    for i, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as e:
            raise ValueError(f"{path}:{i} is not valid JSON: {e}") from e
        if limit is not None and len(rows) >= limit:
            break
    return rows


def _generate_answer(question: str, contexts: list[str]) -> str:
    """Call Kimi to produce an answer from retrieved contexts."""
    context_block = "\n\n".join(f"[Chunk {i + 1}]\n{c}" for i, c in enumerate(contexts))
    user_prompt = f"Context:\n{context_block}\n\nQuestion: {question}\n\nAnswer:"
    response = call_kimi(ANSWER_SYSTEM_PROMPT, user_prompt)
    return response or ""


def _build_dataset(doc: str, document_id: str, tuples: list[dict], top_k: int) -> Dataset:
    """Run live retrieval + answer generation for each golden tuple."""
    questions, answers, contexts, ground_truths, concept_labels = [], [], [], [], []

    for i, row in enumerate(tuples, 1):
        q = row["question"]
        ideal = row["ideal_answer"]
        chunks = retrieve_relevant_chunks(query=q, document_id=document_id, top_k=top_k)
        ctxs = [c["content"] for c in chunks] if chunks else []
        ans = _generate_answer(q, ctxs) if ctxs else ""

        questions.append(q)
        answers.append(ans)
        contexts.append(ctxs)
        ground_truths.append(ideal)
        concept_labels.append(row.get("concept_label", ""))

        logger.info(
            "[%s %d/%d] retrieved=%d answer_chars=%d concept=%s",
            doc, i, len(tuples), len(ctxs), len(ans), row.get("concept_label", ""),
        )

    return Dataset.from_dict(
        {
            "question": questions,
            "answer": answers,
            "contexts": contexts,
            "ground_truth": ground_truths,
            "concept_label": concept_labels,
        }
    )


def _maybe_upload_to_langfuse(doc: str, df: pd.DataFrame) -> None:
    """Best-effort: push per-row scores to Langfuse if keys present."""
    try:
        from app.observability.langfuse import is_enabled, langfuse  # noqa: WPS433
    except Exception:
        return
    if not is_enabled() or langfuse is None:
        logger.info("Langfuse not configured — skipping score upload")
        return

    trace = langfuse.trace(
        name="ragas_eval",
        metadata={"doc": doc, "rows": len(df)},
        tags=["eval", "ragas", doc],
    )
    for col in ("context_precision", "context_recall", "faithfulness", "answer_relevancy"):
        if col not in df.columns:
            continue
        mean = float(df[col].dropna().mean()) if not df[col].dropna().empty else 0.0
        langfuse.score(trace_id=trace.id, name=col, value=mean)
    langfuse.flush()
    logger.info("Uploaded Ragas means to Langfuse trace %s", trace.id)


def _summarize(doc: str, df: pd.DataFrame) -> None:
    print(f"\n=== {doc} | {len(df)} rows ===")
    for col in ("context_precision", "context_recall", "faithfulness", "answer_relevancy"):
        if col not in df.columns:
            continue
        s = df[col].dropna()
        if s.empty:
            print(f"  {col}: n/a")
            continue
        print(f"  {col}: mean={s.mean():.3f} std={s.std():.3f} n={len(s)}")


def _run_one(doc: str, limit: int | None, top_k: int, no_langfuse: bool) -> None:
    cfg = _load_config(doc)
    document_id = cfg["document_id"]
    tuples = _load_tuples(doc, limit)
    if not tuples:
        logger.warning("No tuples loaded for %s — skipping", doc)
        return

    logger.info("Running eval: doc=%s document_id=%s rows=%d top_k=%d",
                doc, document_id, len(tuples), top_k)

    ds = _build_dataset(doc, document_id, tuples, top_k)
    judge_llm = build_judge_llm()
    judge_emb = build_judge_embeddings()

    result = evaluate(
        ds,
        metrics=[context_precision, context_recall, faithfulness, answer_relevancy],
        llm=judge_llm,
        embeddings=judge_emb,
    )

    df = result.to_pandas()
    RESULTS_DIR.mkdir(exist_ok=True)
    ts = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = RESULTS_DIR / f"{doc}_{ts}.csv"
    df.to_csv(out_path, index=False)
    logger.info("Wrote %s", out_path)

    _summarize(doc, df)
    if not no_langfuse:
        _maybe_upload_to_langfuse(doc, df)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Ragas eval against live retrieval.")
    parser.add_argument(
        "--doc",
        default="all",
        help="Golden doc name (ddia, product_analytics, attention) or 'all'.",
    )
    parser.add_argument("--limit", type=int, default=None, help="Cap rows per doc.")
    parser.add_argument("--top-k", type=int, default=5, help="Retrieval top_k.")
    parser.add_argument("--no-langfuse", action="store_true", help="Skip score upload.")
    args = parser.parse_args()

    if args.doc == "all":
        docs = sorted({p.stem.replace(".config", "")
                       for p in GOLDEN_DIR.glob("*.config.json")})
    else:
        docs = [args.doc]

    if not docs:
        logger.error("No golden docs found in %s", GOLDEN_DIR)
        sys.exit(1)

    for doc in docs:
        try:
            _run_one(doc, args.limit, args.top_k, args.no_langfuse)
        except FileNotFoundError as e:
            logger.error("%s — skipping", e)
        except Exception:
            logger.exception("Eval failed for %s", doc)


if __name__ == "__main__":
    main()
