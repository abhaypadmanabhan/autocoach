# Golden eval tuples — human curation guide

This directory holds **human-fillable templates** for the AutoCoach RAG eval
golden set. The Ragas runner (`backend/evals/run_ragas.py`) does **not** read
from here — it reads the filled data from `backend/evals/golden/`. Your job:
fill a template, then save the filled file as `golden/<doc>.jsonl`.

> **Do not fabricate ground truth.** Every `source_chunk_text` must be a
> verbatim (or near-verbatim) excerpt from the actual PDF, and every
> `ideal_answer` must be a correct reference answer you wrote by hand. The
> runner rejects template placeholders, but it cannot verify factual accuracy
> — that is a human responsibility.

## The 3 target docs

| slug | source PDF | config | template |
| --- | --- | --- | --- |
| `ddia` | Designing Data-Intensive Applications (Kleppmann) | `../golden/ddia.config.json` | `ddia.template.jsonl` |
| `product_analytics` | a product-analytics PDF | `../golden/product_analytics.config.json` | `product_analytics.template.jsonl` |
| `attention` | Attention Is All You Need (Vaswani et al.) | `../golden/attention.config.json` | `attention.template.jsonl` |

Target: **30 tuples per doc** (10 easy / 10 medium / 10 hard), spread across
different chapters/sections. Each template below ships a few starter rows —
duplicate them and fill until you reach 30.

## Tuple format

One JSON object per line (JSONL). Required fields:

| field | type | meaning |
| --- | --- | --- |
| `question` | string | A real question a learner would ask. |
| `source_chunk_text` | string | ~200–500 chars of the chunk that **should** be retrieved. Ground truth for `context_recall`. Use a verbatim excerpt from the PDF. (`source_chunk` is accepted as an alias.) |
| `ideal_answer` | string | 1–3 sentence reference answer. Ground truth for `faithfulness` + `context_precision`. |
| `concept_label` | string (optional) | Short label for grouping in the CSV output. |

Example (real, hand-written — replace with your own):
```json
{"question": "What problem does the write-ahead log solve?", "source_chunk_text": "A write-ahead log (WAL) ensures durability by writing every change to a sequential log on disk before applying it to the in-memory data structure.", "ideal_answer": "It guarantees durability: changes are persisted to disk before being applied in memory.", "concept_label": "WAL"}
```

## Step-by-step: from template to first Ragas baseline

1. **Upload the PDF to your DEV environment** through the AutoCoach app. Wait
   until the document `status` becomes `ready`.
2. **Copy the real `documents.id` UUID** from Supabase: Table editor →
   `documents` → find your row → copy the `id` column (a UUID like
   `550e8400-e29b-41d4-a716-446655440000`).
3. **Paste that UUID into `../golden/<doc>.config.json`** under `document_id`,
   replacing the `REPLACE_WITH_...` placeholder. You may also set `top_k` and
   `notes`.
4. **Fill the template**: open `tuples/<doc>.template.jsonl`, replace every
   `<paste ...>` field with real content (verbatim source excerpt + your
   reference answer). Add rows until you have ~30. Difficulty mix: 10 easy /
   10 medium / 10 hard, across chapters.
5. **Save the filled file as `../golden/<doc>.jsonl`** (overwrite the sample
   scaffold if present).
6. **Install eval deps + run**:
   ```bash
   cd backend
   source venv/bin/activate
   pip install -r evals/requirements.txt
   python -m evals.run_ragas --doc ddia --limit 5   # smoke run on 5 rows
   python -m evals.run_ragas --doc ddia              # full 30
   python -m evals.run_ragas --doc all               # all 3 docs
   ```
7. **Read the output**:
   - Stdout: per-metric mean ± std.
   - `evals/results/<doc>_<utc-timestamp>.csv`: per-row scores (gitignored).
   - Langfuse Cloud (if `LANGFUSE_*` keys set): scores on a `ragas_eval` trace.

## What the runner checks for you

- **Placeholder `document_id`** → clear, actionable error (no stack trace):
  upload the PDF, paste the UUID, re-run.
- **Placeholder / empty tuple fields** → `TupleError` naming the file + line.
- **Missing required fields** → helpful message pointing back to this README.
- **Bad JSON** → the offending file + line number.

## What the runner CANNOT check

- Whether `source_chunk_text` is actually verbatim from the PDF.
- Whether `ideal_answer` is factually correct.
- Whether a question is at the right difficulty.

Those are curation quality — a human step.

## Metrics + starting bars

| metric | measures | starting bar |
| --- | --- | --- |
| `context_precision` | Of retrieved chunks, how many are relevant? | ≥ 0.6 |
| `context_recall` | Of the ideal context, how much was retrieved? | ≥ 0.7 |
| `faithfulness` | Is the generated answer grounded in retrieved context? | ≥ 0.8 |
| `answer_relevancy` | Does the answer address the question? | ≥ 0.75 |

Bars are starting points — re-baseline after the first real run.
