"""Ragas eval runner — robust, testable, no fabricated ground truth.

Loads a hand-curated golden JSONL (``golden/<doc>.jsonl``), retrieves context
from the LIVE Qdrant pipeline, generates an answer through Kimi, scores with
Ragas (Kimi-as-judge), and writes a per-row CSV + stdout summary. Optionally
uploads mean scores to Langfuse Cloud.

Run (from backend/)::

    python -m evals.run_ragas --doc ddia --limit 5
    python -m evals.run_ragas --doc all --limit 5
    python -m evals.run_ragas --doc ddia --no-langfuse

Design notes
------------
- App-service imports (retrieval, llm, kimi_judge, ragas, datasets) are LAZY:
  they live inside the live adapters so the module imports cleanly without
  Qdrant/LLM keys. That lets the CLI surface a clean placeholder-doc-id error
  and lets unit tests run hermetically with injected stubs.
- Retrieval, answer-generation, and the Ragas evaluator are INJECTABLE so the
  full pipeline can be exercised end-to-end on synthetic fixtures with no
  network or API key.
- This module never invents ground truth; it only scores what a human curated.
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging
import math
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any, Optional, Protocol

from evals.config import ConfigError, PlaceholderDocIdError, load_config
from evals.tuples_io import TupleError, load_tuples

logger = logging.getLogger("evals.run_ragas")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

EVAL_DIR = Path(__file__).resolve().parent
GOLDEN_DIR = EVAL_DIR / "golden"
RESULTS_DIR = EVAL_DIR / "results"

# Metric columns reported (and written to CSV). Kept as strings so the stub
# evaluator (tests) and the live evaluator agree on names without importing
# ragas at module load.
METRIC_COLUMNS = ("context_precision", "context_recall", "faithfulness", "answer_relevancy")
REPORTED_METRIC_COLUMNS = (
    "context_precision",
    "context_recall",
    "retrieval_hit_at_k",
    "faithfulness",
    "answer_relevancy",
)

ANSWER_SYSTEM_PROMPT = (
    "You answer questions strictly from the provided context. "
    "If the context does not contain the answer, say so. "
    "Be concise — 1–3 sentences."
)

_RESULT_METADATA_COLUMNS = (
    "row_index",
    "doc",
    "document_label",
    "question",
    "answer",
    "reference",
    "concept_label",
    "context_count",
    "retrieval_hit_at_k",
)

_SKIP_RESULT_COLUMNS = frozenset({
    "row_index",
    "doc",
    "document_label",
    "question",
    "user_input",
    "answer",
    "response",
    "ground_truth",
    "reference",
    "concept_label",
    "context_count",
    "retrieval_hit_at_k",
    "source_chunk_text",
})


class RetrievalCoverageError(RuntimeError):
    """Live retrieval returned no contexts for too many golden rows."""


class RetrieveFn(Protocol):
    def __call__(self, query: str, document_id: str, top_k: int) -> list[str]: ...


class AnswerFn(Protocol):
    def __call__(self, question: str, contexts: list[str]) -> str: ...


class EvalResult(Protocol):
    def to_pandas(self) -> pd.DataFrame: ...


def _normalize_evidence_text(text: str) -> str:
    """Collapse PDF extraction artifacts for deterministic evidence matching."""
    normalized = unicodedata.normalize("NFKC", text).lower()
    normalized = normalized.replace("\u00ad", "")
    normalized = re.sub(r"(?<=\w)-\s+(?=\w)", "", normalized)
    normalized = re.sub(r"(?<=\w)!\s+(?=\w)", "", normalized)
    return re.sub(r"[^a-z0-9]+", "", normalized)


def retrieval_hit_at_k(source_chunk_text: str, contexts: list[str]) -> bool:
    """True when the curated source excerpt appears in one retrieved context."""
    expected = _normalize_evidence_text(source_chunk_text)
    if not expected:
        return False
    return any(expected in _normalize_evidence_text(ctx or "") for ctx in contexts)


def live_retrieve(query: str, document_id: str, top_k: int) -> list[str]:
    """Live retrieval adapter — returns chunk *contents* (not the full dicts)."""
    from app.services.retrieval import retrieve_relevant_chunks  # lazy

    chunks = retrieve_relevant_chunks(query=query, document_id=document_id, top_k=top_k)
    return [c["content"] for c in chunks] if chunks else []


def live_answer(question: str, contexts: list[str]) -> str:
    """Live answer-generation adapter through Kimi."""
    from app.services.llm import call_kimi  # lazy

    if not contexts:
        return ""
    context_block = "\n\n".join(f"[Chunk {i + 1}]\n{c}" for i, c in enumerate(contexts))
    user_prompt = f"Context:\n{context_block}\n\nQuestion: {question}\n\nAnswer:"
    return call_kimi(ANSWER_SYSTEM_PROMPT, user_prompt) or ""


def default_evaluator(
    dataset: Any, metrics: list[Any], *, llm: Any = None, embeddings: Any = None
) -> EvalResult:
    """Live Ragas evaluator. Builds the Kimi judge + OpenAI embeddings lazily.

    ``metrics`` may be strings (from ``METRIC_COLUMNS``) or ragas metric objs.
    Pass ``llm``/``embeddings`` to skip building the Kimi judge (used by tests).
    """
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
        from evals.kimi_judge import build_judge_embeddings, build_judge_llm  # lazy
        llm = llm or build_judge_llm()
        embeddings = embeddings or build_judge_embeddings()

    return evaluate(dataset, metrics=resolved, llm=llm, embeddings=embeddings)


def build_dataset(
    tuples: list[dict],
    *,
    document_id: str,
    top_k: int,
    retrieve: RetrieveFn,
    answer: AnswerFn,
    doc: str = "",
) -> Any:
    """Run retrieval + answer generation for each golden tuple -> Ragas Dataset.

    Pure orchestration: the side-effecting work is delegated to the injected
    ``retrieve`` / ``answer`` callables, so this is fully testable with stubs.
    """
    from datasets import Dataset  # lazy: keeps `import evals.run_ragas` light

    questions, answers, contexts, ground_truths, concept_labels = [], [], [], [], []
    source_chunk_texts, retrieval_hits, context_counts, row_indexes = [], [], [], []
    for i, row in enumerate(tuples, 1):
        q = row["question"]
        ctxs = list(retrieve(query=q, document_id=document_id, top_k=top_k) or [])
        ans = answer(question=q, contexts=ctxs)
        source_chunk_text = row["source_chunk_text"]
        questions.append(q)
        answers.append(ans)
        contexts.append(ctxs)
        ground_truths.append(row["ideal_answer"])
        concept_labels.append(row.get("concept_label", ""))
        source_chunk_texts.append(source_chunk_text)
        retrieval_hits.append(retrieval_hit_at_k(source_chunk_text, ctxs))
        context_counts.append(len(ctxs))
        row_indexes.append(i)
        logger.info(
            "[%s %d/%d] retrieved=%d answer_chars=%d concept=%s",
            doc or "?", i, len(tuples), len(ctxs), len(ans), row.get("concept_label", ""),
        )
    return Dataset.from_dict(
        {
            "question": questions,
            "answer": answers,
            "contexts": contexts,
            "ground_truth": ground_truths,
            "concept_label": concept_labels,
            "source_chunk_text": source_chunk_texts,
            "retrieval_hit_at_k": retrieval_hits,
            "context_count": context_counts,
            "row_index": row_indexes,
        }
    )


def _empty_output_frame() -> Any:
    import pandas as pd  # lazy: eval-only dep, not in base requirements

    return pd.DataFrame(columns=[*_RESULT_METADATA_COLUMNS, *METRIC_COLUMNS])


def _enforce_retrieval_coverage(dataset: Any, *, max_zero_context_rows: int) -> None:
    zero_rows = [
        (row_index, question)
        for row_index, question, context_count in zip(
            dataset["row_index"], dataset["question"], dataset["context_count"]
        )
        if context_count == 0
    ]
    if len(zero_rows) <= max_zero_context_rows:
        return

    details = "\n".join(f"  row {row_index}: {question}" for row_index, question in zero_rows)
    raise RetrievalCoverageError(
        "Retrieval returned zero contexts for "
        f"{len(zero_rows)} row(s), above allowed threshold {max_zero_context_rows}:\n"
        f"{details}"
    )


def build_output_dataframe(
    result_df: Any,
    dataset: Any,
    *,
    doc: str,
    document_label: str,
) -> Any:
    """Merge Ragas scores with stable golden-row metadata for CSV/upload."""
    import pandas as pd  # lazy: eval-only dep, not in base requirements

    if len(result_df) != len(dataset):
        raise ValueError(
            f"Ragas returned {len(result_df)} rows for {len(dataset)} eval rows."
        )

    df = pd.DataFrame({
        "row_index": dataset["row_index"],
        "doc": [doc] * len(dataset),
        "document_label": [document_label] * len(dataset),
        "question": dataset["question"],
        "answer": dataset["answer"],
        "reference": dataset["ground_truth"],
        "concept_label": dataset["concept_label"],
        "context_count": dataset["context_count"],
        "retrieval_hit_at_k": dataset["retrieval_hit_at_k"],
    })

    for col in METRIC_COLUMNS:
        if col in result_df.columns:
            df[col] = list(result_df[col])

    for col in result_df.columns:
        if col in df.columns or col in _SKIP_RESULT_COLUMNS:
            continue
        df[col] = list(result_df[col])

    return df


def metric_means(df: Any, columns: tuple[str, ...] = REPORTED_METRIC_COLUMNS) -> dict[str, float]:
    means: dict[str, float] = {}
    for col in columns:
        if col not in df.columns:
            continue
        series = df[col].dropna()
        if getattr(series, "empty", False):
            continue
        means[col] = float(series.mean())
    return means


def summarize(doc: str, df: pd.DataFrame) -> None:
    print(f"\n=== {doc} | {len(df)} rows ===")
    for col in REPORTED_METRIC_COLUMNS:
        if col not in df.columns:
            continue
        s = df[col].dropna()
        if s.empty:
            print(f"  {col}: n/a")
            continue
        std = float(s.std()) if len(s) > 1 else 0.0
        print(f"  {col}: mean={float(s.mean()):.3f} std={std:.3f} n={len(s)}")


def _row_get(row: Any, key: str, default: Any = "") -> Any:
    if hasattr(row, "get"):
        return row.get(key, default)
    try:
        return row[key]
    except (KeyError, TypeError, IndexError):
        return default


def _score_value(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(numeric):
        return None
    return numeric


def _first_value(df: Any, column: str, default: Any = "") -> Any:
    if column not in df.columns or len(df) == 0:
        return default
    try:
        values = df[column]
        if hasattr(values, "values"):
            return values.values[0]
        return list(values)[0]
    except Exception:
        return default


def _safe_chunk_ids(row: Any) -> list[str]:
    raw = _row_get(row, "retrieved_chunk_ids", _row_get(row, "chunk_ids", []))
    if not isinstance(raw, (list, tuple)):
        return []
    safe_ids: list[str] = []
    for item in raw:
        if isinstance(item, (str, int)):
            safe_ids.append(str(item))
    return safe_ids


def _upload_scores(langfuse: Any, *, trace_id: str, values: dict[str, Any], metadata: dict) -> None:
    for col in REPORTED_METRIC_COLUMNS:
        if col not in values:
            continue
        value = _score_value(values[col])
        if value is None:
            continue
        langfuse.create_score(
            trace_id=trace_id,
            name=col,
            value=value,
            data_type="NUMERIC",
            metadata=metadata,
        )


def maybe_upload_to_langfuse(doc: str, df: pd.DataFrame) -> None:
    """Best-effort: push aggregate and per-row eval scores to Langfuse."""
    try:
        from app.observability.langfuse import is_enabled, langfuse  # lazy
        from langfuse import propagate_attributes  # lazy
    except Exception:
        return
    if not is_enabled() or langfuse is None:
        logger.info("Langfuse not configured — skipping score upload")
        return

    document_label = _first_value(df, "document_label", doc) or doc
    aggregate_metadata = {"doc": doc, "rows": len(df), "document_label": document_label}
    aggregate_trace_id = langfuse.create_trace_id()
    with propagate_attributes(
        trace_name="ragas_eval_aggregate",
        metadata=aggregate_metadata,
        tags=["eval", "ragas", doc, "aggregate"],
    ):
        with langfuse.start_as_current_observation(
            name="ragas_eval_aggregate",
            as_type="span",
            trace_context={"trace_id": aggregate_trace_id},
            metadata=aggregate_metadata,
        ):
            _upload_scores(
                langfuse,
                trace_id=aggregate_trace_id,
                values=metric_means(df),
                metadata={"doc": doc, "scope": "aggregate"},
            )

    row_propagation_metadata = {"doc": doc, "rows": len(df)}
    for _, row in df.iterrows():
        row_trace_id = langfuse.create_trace_id()
        row_index = _row_get(row, "row_index", "")
        row_metadata = {
            "doc": doc,
            "row_index": row_index,
            "question": _row_get(row, "question", ""),
            "document_label": _row_get(row, "document_label", document_label) or document_label,
            "concept_label": _row_get(row, "concept_label", ""),
            "generated_answer": _row_get(row, "answer", ""),
            "retrieval_hit_at_k": bool(_row_get(row, "retrieval_hit_at_k", False)),
            "retrieved_contexts": {
                "context_count": int(_row_get(row, "context_count", 0) or 0),
                "chunk_ids": _safe_chunk_ids(row),
            },
        }
        row_scores = {col: _row_get(row, col, None) for col in REPORTED_METRIC_COLUMNS}
        with propagate_attributes(
            trace_name="ragas_eval_row",
            metadata=row_propagation_metadata,
            tags=["eval", "ragas", doc, "row"],
        ):
            with langfuse.start_as_current_observation(
                name="ragas_eval_row",
                as_type="span",
                trace_context={"trace_id": row_trace_id},
                metadata=row_metadata,
            ):
                _upload_scores(
                    langfuse,
                    trace_id=row_trace_id,
                    values=row_scores,
                    metadata={"doc": doc, "row_index": row_index},
                )

    langfuse.flush()
    logger.info(
        "Uploaded Ragas means to Langfuse trace %s and %d row traces",
        aggregate_trace_id,
        len(df),
    )


# Backward-compat alias for the pre-existing regression test
# tests/test_evals_review_fixes.py (calls module._maybe_upload_to_langfuse).
_maybe_upload_to_langfuse = maybe_upload_to_langfuse


def run_one(
    doc: str,
    *,
    limit: Optional[int],
    top_k: Optional[int],
    retrieve: RetrieveFn = live_retrieve,
    answer: AnswerFn = live_answer,
    evaluator: Any = default_evaluator,
    results_dir: Path = RESULTS_DIR,
    no_langfuse: bool = False,
    golden_dir: Path = GOLDEN_DIR,
    max_zero_context_rows: Optional[int] = None,
) -> pd.DataFrame:
    """Run the full eval pipeline for one doc. Returns the per-row DataFrame."""
    cfg = load_config(doc, golden_dir=golden_dir)
    effective_top_k = top_k if top_k is not None else cfg.top_k
    effective_max_zero_context_rows = (
        max_zero_context_rows
        if max_zero_context_rows is not None
        else cfg.max_zero_context_rows
    )
    tuples = load_tuples(doc, limit=limit, golden_dir=golden_dir)
    if not tuples:
        logger.warning("No tuples loaded for %s — skipping", doc)
        return _empty_output_frame()

    logger.info(
        "Running eval: doc=%s document_id=%s rows=%d top_k=%d",
        doc, cfg.document_id, len(tuples), effective_top_k,
    )

    ds = build_dataset(
        tuples, document_id=cfg.document_id, top_k=effective_top_k,
        retrieve=retrieve, answer=answer, doc=doc,
    )
    _enforce_retrieval_coverage(
        ds,
        max_zero_context_rows=effective_max_zero_context_rows,
    )

    result = evaluator(ds, list(METRIC_COLUMNS))
    df = build_output_dataframe(
        result.to_pandas(),
        ds,
        doc=doc,
        document_label=cfg.label,
    )

    results_dir.mkdir(parents=True, exist_ok=True)
    ts = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = results_dir / f"{doc}_{ts}.csv"
    df.to_csv(out_path, index=False)
    logger.info("Wrote %s", out_path)

    summarize(doc, df)
    if not no_langfuse:
        maybe_upload_to_langfuse(doc, df)
    return df


def main(argv: Optional[list[str]] = None, *, golden_dir: Path = GOLDEN_DIR) -> int:
    parser = argparse.ArgumentParser(description="Run Ragas eval against live retrieval.")
    parser.add_argument("--doc", default="all",
                        help="Golden doc slug (ddia, product_analytics, attention) or 'all'.")
    parser.add_argument("--limit", type=int, default=None, help="Cap rows per doc.")
    parser.add_argument("--top-k", type=int, default=None, help="Retrieval top_k (overrides config).")
    parser.add_argument(
        "--max-zero-context-rows",
        type=int,
        default=None,
        help="Abort when more rows than this return zero retrieved contexts.",
    )
    parser.add_argument("--no-langfuse", action="store_true", help="Skip score upload.")
    args = parser.parse_args(argv)

    if args.doc == "all":
        docs = sorted({p.name.removesuffix(".config.json")
                       for p in golden_dir.glob("*.config.json")})
    else:
        docs = [args.doc]

    if not docs:
        logger.error("No golden docs found in %s", golden_dir)
        return 1

    exit_code = 0
    for doc in docs:
        try:
            run_one(doc, limit=args.limit, top_k=args.top_k,
                    no_langfuse=args.no_langfuse, golden_dir=golden_dir,
                    max_zero_context_rows=args.max_zero_context_rows)
        except RetrievalCoverageError as exc:
            logger.error("%s", exc)
            exit_code = 1
        except PlaceholderDocIdError as exc:
            logger.error("%s", exc)  # clean, actionable, no traceback
            exit_code = 1
        except (ConfigError, TupleError) as exc:
            logger.error("%s", exc)
            exit_code = 1
        except FileNotFoundError as exc:
            logger.error("%s — skipping", exc)
            exit_code = 1
        except Exception:
            logger.exception("Eval failed for %s", doc)
            exit_code = 1
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
