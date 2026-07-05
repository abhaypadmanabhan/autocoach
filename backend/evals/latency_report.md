# Latency Profiling Baseline

Issue #25 adds ingestion-stage spans so Langfuse traces can separate document
processing latency into extraction, chunking, embedding, and vector upsert.

## Instrumentation

New spans:

| Stage | Span name | Notes |
| --- | --- | --- |
| Ingestion root | `ingestion.process_document` | Parent span for a document run. |
| Extract | `ingestion.extract` | Wraps PDF/PPTX dispatch. |
| PDF extraction | `text_extraction.pdf` | Input/output capture disabled. |
| PPTX extraction | `text_extraction.pptx` | Input/output capture disabled. |
| Chunk | `ingestion.chunk` | Wraps `chunk_text`. |
| Embed | `ingestion.embed` | Wraps `get_embeddings`; existing `embeddings.openai_3_small` remains nested. |
| Upsert | `ingestion.upsert` | Wraps Qdrant vector storage. |

Payload capture is disabled for file bytes, extracted text, chunks, embeddings,
and vector payloads. The spans remain NOOP-safe when Langfuse credentials are
absent.

## Method

Local run on 2026-07-04 from the Agent 2 worktree. The local worktree has no
`backend/venv` or `.env`, so the main repo virtualenv was reused with dummy
environment values. Langfuse was intentionally disabled, which verified the
NOOP path. To avoid mutating cloud Supabase/Qdrant data or spending API tokens,
embedding and vector upsert calls were stubbed in memory.

Ingestion sample: 10 synthetic PPTX ingestion-shaped runs over page counts
`1, 5, 20, 50, 1, 5, 20, 50, 1, 5`.

Quiz sample: 20 synthetic quiz generation turns through the existing
`quiz.generate_questions` path with retrieval and LLM calls stubbed in memory.
No quiz code was modified for this issue.

Percentiles use nearest-rank p95 and median p50.

## Summary

| Area | Stage | p50 ms | p95 ms |
| --- | --- | ---: | ---: |
| Ingestion | extract | 4.45 | 18.26 |
| Ingestion | chunk | 1.21 | 10.75 |
| Ingestion | embed | 0.14 | 0.39 |
| Ingestion | upsert | 0.05 | 0.07 |
| Ingestion | total measured stages | 5.76 | 28.32 |
| Quiz | generate question turn | 0.06 | 0.12 |

Top hotspot in this local capture: `ingestion.extract` at 18.26 ms p95.

Because external OpenAI, Kimi, Qdrant, and Supabase calls were stubbed here,
production Langfuse traces should be treated as the source of truth for network
and model latency. In production, compare `ingestion.embed` plus nested
`embeddings.openai_3_small`, `ingestion.upsert`, `retrieval.qdrant`, and
`quiz.generate_questions` before deciding whether extraction is still the
bottleneck.

## Ingestion Runs

| Run | Pages | Chunks | Extract ms | Chunk ms | Embed ms | Upsert ms | Total ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 5 | 2.86 | 0.43 | 0.07 | 0.05 | 3.41 |
| 2 | 5 | 25 | 3.61 | 1.23 | 0.10 | 0.05 | 4.99 |
| 3 | 20 | 100 | 10.24 | 4.38 | 0.22 | 0.06 | 14.89 |
| 4 | 50 | 250 | 16.32 | 10.75 | 0.39 | 0.07 | 27.52 |
| 5 | 1 | 5 | 2.54 | 0.29 | 0.05 | 0.04 | 2.92 |
| 6 | 5 | 25 | 4.58 | 1.20 | 0.07 | 0.04 | 5.89 |
| 7 | 20 | 100 | 7.82 | 4.38 | 0.20 | 0.07 | 12.47 |
| 8 | 50 | 250 | 18.26 | 9.69 | 0.31 | 0.06 | 28.32 |
| 9 | 1 | 5 | 2.39 | 0.30 | 0.05 | 0.04 | 2.79 |
| 10 | 5 | 25 | 4.31 | 1.08 | 0.18 | 0.04 | 5.62 |

## Quiz Turns

| Metric | Runs | p50 ms | p95 ms |
| --- | ---: | ---: | ---: |
| Stubbed `quiz.generate_questions` turn | 20 | 0.06 | 0.12 |

The first quiz turn warmed Python and Langfuse decorator state at 1.03 ms; the
nearest-rank p95 was 0.12 ms after sorting all 20 turns.
