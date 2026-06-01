# AutoCoach RAG eval harness

Local-only Ragas runner. Measures retrieval + answer quality on a hand-curated golden set against the **live** Qdrant + retrieval pipeline. $0 marginal cost (Kimi-as-judge through the key you already have).

## Layout

```
backend/evals/
├── requirements.txt          # ragas, langchain-openai, pandas
├── kimi_judge.py             # LangChain-compatible Kimi wrapper for Ragas
├── run_ragas.py              # CLI runner
├── golden/
│   ├── ddia.config.json
│   ├── ddia.jsonl
│   ├── product_analytics.config.json
│   ├── product_analytics.jsonl
│   ├── attention.config.json
│   └── attention.jsonl
└── results/                  # CSV outputs (gitignored)
```

## Setup (one-time)

```bash
source backend/venv/bin/activate
pip install -r backend/evals/requirements.txt
```

`backend/.env` must already have `SUPABASE_*`, `QDRANT_*`, `KIMI_API_KEY`, `OPENAI_API_KEY` for retrieval + judge. `LANGFUSE_*` is optional — set it to upload per-row scores to Langfuse Cloud.

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

## Cost

- Retrieval: free (uses your existing Qdrant Cloud cluster + OpenAI embedding call already paid for at ingestion time).
- Judge: ~4 Kimi calls per row × 30 rows × 3 docs = ~360 Kimi calls per full run. Each ≤4k output tokens. Negligible.
- Storage: CSV local. Langfuse Cloud free tier covers it.
