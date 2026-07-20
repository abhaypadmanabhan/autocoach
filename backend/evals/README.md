# AutoCoach RAG eval harness

Local-only Ragas runner. Measures retrieval + answer quality on a hand-curated golden set against the **live** Qdrant + retrieval pipeline. It is low-cost, not free: every row embeds the query for retrieval, generates a synthetic eval answer, and asks Kimi/Ragas to judge it.

## Layout

```
backend/evals/
├── requirements.txt          # loose eval dependency ranges
├── requirements.lock.txt     # reproduced from the verified eval venv
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
└── results/                  # local CSV outputs (gitignored; not tracked)
```

## Setup (one-time)

### Environment

The eval stack **cannot be installed into the app venv as-is**: `backend/requirements.txt` pins `openai==2.x` and `langchain-core==1.x`, while `ragas 0.2.x` + `langchain-openai 0.2.x` require `openai<2` and `langchain-core 0.3.x`. Build a dedicated eval venv instead of modifying the application venv:

```bash
cd backend
python3 -m venv .venv-evals
. .venv-evals/bin/activate
python -m pip install --upgrade pip
python -m pip install -r evals/requirements.lock.txt
```

Use `evals/requirements.txt` only when intentionally refreshing dependency ranges; after a successful refresh, regenerate `evals/requirements.lock.txt` from that eval venv.

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
   - `source_chunk_text`: ~200–500 chars of the chunk that should be retrieved. Used by deterministic `retrieval_hit_at_k` matching after whitespace/hyphenation normalization.
   - `ideal_answer`: 1–3 sentence reference answer. Used as the Ragas reference for `context_precision` and `context_recall`.
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
- `evals/results/<doc>_<utc-timestamp>.csv`: local per-row scores including `concept_label`, `reference`, and deterministic `retrieval_hit_at_k`.
- Langfuse Cloud (when keys present): one aggregate trace with document-level means, plus one inspectable trace per golden row.

The answer-generation prompt in `run_ragas.py` is an eval-only synthetic QA path. It is not an exact copy of the current AutoCoach adaptive quiz product flow.

### Retrieval coverage guard

The runner aborts before Ragas if more than `max_zero_context_rows` rows return zero retrieved contexts. The default is `0`, because zero contexts usually means the live retrieval path or document mapping is broken. Configure it per document in `golden/<doc>.config.json` or for one run:

```bash
python -m evals.run_ragas --doc ddia --max-zero-context-rows 1
```

The error lists affected row indexes and questions. This gate is separate from `retrieval_hit_at_k`: a row can retrieve contexts but still fail to retrieve the curated evidence.

## Metrics

| Metric | What it measures | Pass bar |
| --- | --- | --- |
| `context_precision` | Of retrieved chunks, how many are relevant? | ≥ 0.6 |
| `context_recall` | Whether claims in the `ideal_answer` reference are supported by retrieved contexts. It is not a direct `source_chunk_text` substring check. | ≥ 0.7 |
| `retrieval_hit_at_k` | Deterministic normalized match: did any retrieved context contain the curated `source_chunk_text` evidence? | ≥ 0.85 |
| `faithfulness` | Does the generated answer stay grounded in retrieved contexts? Uses generated answer + retrieved contexts. | ≥ 0.8 |
| `answer_relevancy` | Does the answer address the question? Uses question + generated answer. | ≥ 0.75 |

Bars are starting points — re-baseline after first run.

## First real baseline (2026-07-10)

Full `python -m evals.run_ragas --doc all` (90 curated tuples, top_k=5, Kimi K2.6 judge, `--no-langfuse`). Aggregate baseline metrics from that historical run:

| Doc | context_precision | context_recall | faithfulness | answer_relevancy |
| --- | --- | --- | --- | --- |
| attention (n=30) | 0.782 ± 0.273 | 1.000 ± 0.000 | 0.919 ± 0.136 | 0.776 ± 0.126 |
| ddia (n=30) | 0.804 ± 0.265 | 1.000 ± 0.000 | 0.941 ± 0.139 | 0.858 ± 0.100 |
| product_analytics (n=30) | 0.911 ± 0.208 | 1.000 ± 0.000 | 0.861 ± 0.264 | 0.846 ± 0.136 |

All four Ragas metrics clear the starting pass bars on every doc. `context_recall=1.000` across the board warrants a skeptical look during re-baselining (Kimi-as-judge may be lenient on recall). That baseline predates `retrieval_hit_at_k`; the next live re-baseline should report it. Detailed baseline CSVs containing retrieved book text are no longer tracked; repository history cleanup/copyright remediation is follow-up issue [#84](https://github.com/abhaypadmanabhan/autocoach/issues/84).

## Judge calibration

`run_ragas` varies retrieval, answer generation and judging all at once, so a moved score cannot be attributed to any one of them. `evals/calibrate.py` holds the first two fixed — it replays rows already saved in a results CSV and re-scores them N times per judge, so everything that moves is the judge. It never calls Qdrant, never generates an answer, and never writes to the CSV it reads.

```bash
# plan + estimated judge calls, no API calls
python -m evals.calibrate --dry-run

# repeatability experiment across both judges
python -m evals.calibrate \
    --rows product_analytics:20,product_analytics:3,ddia:26,ddia:3,attention:7,attention:19 \
    --judges kimi,openai --repeats 3

# rebuild the report from saved scores, no API calls
python -m evals.calibrate --replay evals/reports/judge_calibration_observations_*.csv
```

Judge backends live in `evals/judges.py`. `kimi` (Moonshot K2.6, temperature locked at 0.6 by the provider) remains the default everywhere; `openai` (`gpt-4o-mini`, `temperature=0`, `seed=0`) is selectable for calibration and uses the `OPENAI_API_KEY` the project already requires. Selection is always an explicit CLI argument — no env var can flip the judge mid-run, and `run_ragas` still builds the Kimi judge directly.

Outputs land in `evals/reports/`: a per-observation CSV (every individual score), an aggregates CSV (mean / stdev / min / max / range), and a Markdown report. All three carry identifiers and numbers only — no questions, answers, retrieved context, or credentials. Hand-graded expectations used for the judge-vs-human comparison live in `calibration_labels.json`.

Langfuse upload is opt-in via `--upload-langfuse`; calibration is local by default.

## Langfuse score upload

`maybe_upload_to_langfuse` pushes document-level means to a `ragas_eval_aggregate` trace and creates one `ragas_eval_row` trace per golden row when `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`/`LANGFUSE_HOST` are set and valid. Row traces include question, document label, `concept_label`, generated answer, context count/chunk IDs when available, `retrieval_hit_at_k`, and row metric scores. They do not upload full retrieved chunk text by default.

## CI

`.github/workflows/ci.yml` runs the eval harness's **hermetic** tests (`evals/tests` + `tests/test_evals_review_fixes.py`) in the backend job with only `pandas`+`datasets` added — ragas-dependent tests `importorskip` there because ragas cannot coexist with the app's `openai==2.x` pin (see Environment above). The **live** Ragas run is deliberately NOT a CI gate: it needs real Qdrant/Supabase/Kimi/OpenAI keys, spends money, and takes ~30 min for 90 rows. Tracked in #83 as a scheduled/manual job with its own secrets + a dedicated eval venv.

## Cost

- Retrieval: low cost. Each row embeds the query with OpenAI and queries the existing Qdrant Cloud cluster; ingestion embeddings are already paid, but eval queries still perform embedding requests.
- Synthetic answer generation: 1 Kimi call per row.
- Judge: ~4 Kimi calls per row × 30 rows × 3 docs = ~360 Kimi judge calls per full run. Each ≤4k output tokens. Low cost, not free.
- Storage: CSV local. Langfuse Cloud free tier covers it.
