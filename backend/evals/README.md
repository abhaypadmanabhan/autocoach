# AutoCoach RAG eval harness

Local-only Ragas runner. Measures retrieval + answer quality on a hand-curated golden set against the **live** Qdrant + retrieval pipeline. $0 marginal cost (Kimi-as-judge through the key you already have).

## Layout

```
backend/evals/
├── requirements.txt          # ragas, langchain-openai, pandas
├── kimi_judge.py             # LangChain-compatible Kimi wrapper for Ragas
│                             # (pins temperature=0.6 — the only value K2.6 accepts)
├── run_ragas.py              # CLI runner
├── golden/
│   ├── ddia.config.json
│   ├── ddia.jsonl
│   ├── product_analytics.config.json
│   ├── product_analytics.jsonl
│   ├── attention.config.json
│   └── attention.jsonl
└── results/                  # CSV outputs (gitignored; baseline CSVs force-added)
```

## Setup (one-time)

### Environment

The eval stack **cannot be installed into the app venv as-is**: `backend/requirements.txt` pins `openai==2.x` and `langchain-core==1.x`, while `ragas 0.2.x` + `langchain-openai 0.2.x` require `openai<2` and `langchain-core 0.3.x`. Build a dedicated eval venv that relaxes only those pins (the app's `llm.py` uses the v1-style `OpenAI` client, which works on `openai 1.x`):

```bash
cd backend
python3 -m venv venv            # or a separate eval-venv
grep -vE "^(langchain|openai)" requirements.txt > /tmp/req-eval.txt
./venv/bin/pip install -r /tmp/req-eval.txt -r evals/requirements.txt
```

(`langchain-core`/`langchain-text-splitters` are only used by `app/services/chunking.py`, which the eval path never imports.)

`backend/.env` must already have `SUPABASE_*`, `QDRANT_*`, `KIMI_API_KEY`, `OPENAI_API_KEY` for retrieval + judge. `LANGFUSE_*` is optional — set it to upload per-row scores to Langfuse Cloud. Note the app reads `LANGFUSE_HOST` (not `LANGFUSE_BASE_URL`).

## Step 1 — Curate the golden set

For each doc:

1. **Upload the PDF through the app** in your dev environment. Wait for `status=ready`.
2. **Grab the `documents.id` UUID** from Supabase. Paste it into `golden/<doc>.config.json`:
   ```json
   { "document_id": "11111111-1111-1111-1111-111111111111", "label": "DDIA Ch. 1-3" }
   ```
3. **Write 30 tuples** to `golden/<doc>.jsonl`, one JSON object per line:
   ```json
   { "question": "What problem does the write-ahead log solve?", "source_chunk_text": "A write-ahead log (WAL) ensures durability by ...", "ideal_answer": "It guarantees durability: changes are persisted to disk before being applied to the in-memory state.", "concept_label": "WAL" }
   ```
   - `question`: a real question a learner would ask.
   - `source_chunk_text`: ~200–500 chars of the chunk that should be retrieved. Used for **context_recall** ground truth.
   - `ideal_answer`: 1–3 sentence reference answer. Used for **answer_relevancy** and **faithfulness**.
   - `concept_label`: short label for grouping in the CSV.

Aim for 10 easy / 10 medium / 10 hard questions covering different chapters.

## Step 2 — Run

```bash
cd backend
python -m evals.run_ragas --doc ddia
python -m evals.run_ragas --doc all --limit 5   # dry run subset
python -m evals.run_ragas --doc ddia --no-langfuse
```

Output:
- Stdout: per-metric mean ± std.
- `evals/results/<doc>_<utc-timestamp>.csv`: per-row scores.
- Langfuse Cloud (when keys present): scores attached to a `ragas_eval` trace.

## Metrics

| Metric | What it measures | Pass bar |
| --- | --- | --- |
| `context_precision` | Of retrieved chunks, how many are relevant? | ≥ 0.6 |
| `context_recall` | Of the ideal context, how much was retrieved? | ≥ 0.7 |
| `faithfulness` | Does the generated answer stay grounded in retrieved context? | ≥ 0.8 |
| `answer_relevancy` | Does the answer address the question? | ≥ 0.75 |

Bars are starting points — re-baseline after first run.

## First real baseline (2026-07-10)

Full `python -m evals.run_ragas --doc all` (90 curated tuples, top_k=5, Kimi K2.6 judge, `--no-langfuse`). Per-row CSVs in `results/*_20260710T*.csv`; 0 NaN scores.

| Doc | context_precision | context_recall | faithfulness | answer_relevancy |
| --- | --- | --- | --- | --- |
| attention (n=30) | 0.782 ± 0.273 | 1.000 ± 0.000 | 0.919 ± 0.136 | 0.776 ± 0.126 |
| ddia (n=30) | 0.804 ± 0.265 | 1.000 ± 0.000 | 0.941 ± 0.139 | 0.858 ± 0.100 |
| product_analytics (n=30) | 0.911 ± 0.208 | 1.000 ± 0.000 | 0.861 ± 0.264 | 0.846 ± 0.136 |

All four metrics clear the starting pass bars on every doc. `context_recall=1.000` across the board warrants a skeptical look during re-baselining (Kimi-as-judge may be lenient on recall).

## Langfuse score upload

`maybe_upload_to_langfuse` pushes per-doc metric means to Langfuse Cloud when `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`/`LANGFUSE_HOST` are set and valid. As of 2026-07-10 the keys in the local `backend/.env` return **401 Unauthorized** against both `us.cloud.langfuse.com` and `cloud.langfuse.com` (verified with `curl -u pk:sk .../api/public/projects`) — they appear rotated. The first real baseline was therefore run with `--no-langfuse`; rotate the local keys and re-run without the flag to publish scores. (Railway's production keys are managed separately and unaffected.)

## CI

`.github/workflows/ci.yml` runs the eval harness's **hermetic** tests (`evals/tests` + `tests/test_evals_review_fixes.py`) in the backend job with only `pandas`+`datasets` added — ragas-dependent tests `importorskip` there because ragas cannot coexist with the app's `openai==2.x` pin (see Environment above). The **live** Ragas run is deliberately NOT a CI gate: it needs real Qdrant/Supabase/Kimi/OpenAI keys, spends money, and takes ~30 min for 90 rows. Tracked as a follow-up (scheduled/manual job with its own secrets + a dedicated eval venv).

## Cost

- Retrieval: free (uses your existing Qdrant Cloud cluster + OpenAI embedding call already paid for at ingestion time).
- Judge: ~4 Kimi calls per row × 30 rows × 3 docs = ~360 Kimi calls per full run. Each ≤4k output tokens. Negligible.
- Storage: CSV local. Langfuse Cloud free tier covers it.
