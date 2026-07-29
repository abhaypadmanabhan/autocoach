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
- `evals/results/<doc>_<utc-timestamp>.csv`: local per-row scores including `concept_label`, `reference`, and deterministic `retrieval_hit_at_k`. The `retrieved_chunk_ids` column is JSON-encoded (`json.dumps` on write) so it round-trips through `json.loads` with its `None` holes intact — do not parse it as a Python repr.
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
python -m evals.calibrate --replay evals/reports/sixrow_observations.csv
```

Judge backends live in `evals/judges.py`. `kimi` (Moonshot K2.6, temperature locked at 0.6 by the provider) remains the default everywhere; `openai` (`gpt-4o-mini`, `temperature=0`, `seed=0`) is selectable for calibration and uses the `OPENAI_API_KEY` the project already requires. Selection is always an explicit CLI argument — no env var can flip the judge mid-run, and `run_ragas` still builds the Kimi judge directly.

Each run writes three files to `--out-dir`: a per-observation CSV (every individual score), an aggregates CSV (mean / stdev / min / max / range), and a Markdown report. All three carry identifiers and numbers only — no questions, answers, retrieved context, or credentials.

Balanced calibration cases in `calibration_cases.json` carry hashes for the source question and answer. A swapped-question case also hashes the neighboring question actually scored. Materialization refuses missing rows, drifted text, or an ambiguous mutation before any judge call. Threshold sweeps reuse one fixed observation set and are exploratory sensitivity analysis, not held-out validation or a metric gate.

`--out-dir` defaults to `evals/results/calibration/`, which is gitignored: **a run produces disposable artifacts.** Only two things are committed under `evals/reports/`, promoted by hand:

- `sixrow_observations.csv` — the raw scores from the 2026-07-20 six-row experiment. Kept because it is the one artifact that *cannot* be regenerated: the judge calls cost money and are not deterministic.
- `sixrow_calibration.md` — the decision document those scores support.

The aggregates CSV is deliberately not committed; `--replay` reproduces it byte-identically from the observations for free. Hand-graded expectations used for the judge-vs-human comparison live in `calibration_labels.json` (configuration, not output).

Langfuse upload is opt-in via `--upload-langfuse`; calibration is local by default.

## Balanced calibration cases

The six-row label set above is all faithful examples, so it can measure only the faithful rejection rate (faithful cases predicted unfaithful / all faithful cases) — a judge that called every answer faithful would score perfectly against it. `calibration_cases.json` adds a balanced set that measures both error directions.

A case is not a hand-written answer. It is a deterministic **mutation** of an answer the pipeline really produced, scored against the contexts that answer was really generated from — so the negatives are failure modes the system actually exhibits, and the label follows from what the mutation changed.

```bash
# structural validation + distribution, no baselines needed
python -m evals.calibration_cases --summary

# materialise every case from the local baselines and check hashes
python -m evals.calibration_cases --validate

# inspect one case locally (prints source-derived text — never redirect into a tracked file)
python -m evals.calibration_cases --show 13

# judge-vs-human agreement
python -m evals.calibration_agreement --dry-run
python -m evals.calibration_agreement --judges kimi,openai --repeats 3

# rebuild the report from saved scores, no judge calls
python -m evals.calibration_agreement --replay evals/reports/balanced_cases_observations.csv
```

**What is committed.** Only document and row identifiers, mutation instructions, expected labels, short original-wording rationales, and 16-character hashes of the source question and answer. No questions, answers or retrieved contexts — those derive from third-party PDFs. Mutation `text` params are invented claims, verified by test to appear in none of the contexts they are applied to.

**Why the hashes.** Materialisation fails loudly when a source row is missing, or when its text no longer hashes to the committed value, so a case can never be silently scored against different inputs than the ones it was labelled against. Re-verify a case by hand before re-hashing it.

**Labels.** `expected_faithfulness` is binary (`faithful` / `unfaithful`): faithful means every claim in the answer is supported by the retrieved contexts. No fractional ground truth is asserted — Ragas returns a fraction whose denominator is however many statements its own splitter produced, which is not a quantity any human labelled. `expected_quality` is separate and ordinal (`responsive` / `partially_responsive` / `non_responsive`) and says nothing about correctness: a confidently wrong answer is still responsive.

Findings from the first run are in `reports/balanced_cases_agreement.md`, with the raw scores in `reports/balanced_cases_observations.csv`.

## Relation-aware grounded correctness (experimental)

Ragas `faithfulness` decomposes an answer into independently-supported statements and NLI-checks each against the contexts. That structure can miss **relational** errors when individual component statements are supported but their combined relationship is wrong. On this 24-case set, faithfulness at threshold 0.5 missed both tested reversed-causality cases and detected only 1/12 unfaithful cases with Kimi and 2/12 with OpenAI (see `reports/balanced_cases_agreement.md`).

`relational_eval.py` + `relational_agreement.py` add an **experimental, diagnostic** evaluator that asks one judge, in a single structured call, whether the *complete meaning* of an answer is supported by the contexts. It is **not a gate**, it does **not** replace Ragas faithfulness, and it does **not** change the default judge.

- **One structured call** per (case, judge, replicate). Input: question, generated answer, retrieved contexts. Output JSON: `verdict` (`supported` / `partially_supported` / `unsupported`), `unsupported_claims`, `contradictions`, `relational_errors`, `reasoning_summary` (a short audit note, not hidden chain-of-thought), `confidence`.
- **Raw `openai` SDK transport** (no ragas/langchain) — runs in the app venv, not the `.venv-evals`. Judge selection is always explicit (`--judges kimi,openai`).
- **Defensive parsing**: an unknown verdict, a non-JSON body, or a transport error becomes `insufficient_data` — never silently coerced to `supported`. Missing replicates are excluded from the confusion matrix and reported, not treated as classifications.
- **Verdict → binary label**: `supported` → faithful; `partially_supported` / `unsupported` → unfaithful; `insufficient_data` → excluded (reported). Partial-support behaviour is also reported separately.
- **Grounded correctness is kept separate from responsiveness.** The evaluator judges grounding only; a grounded but non-responsive answer stays grounded. Responsiveness lives in `expected_quality`, unchanged.
- **Comparison parity is strict.** Relational and retained Ragas observations must contain the exact same 24 `(document, case_id)` keys for each judge; missing or foreign keys abort the comparison, and attribution never falls back to case ID alone. Source question/answer hashes are validated when the shared case registry is materialised.
- **Replicates are repeated measurements.** Three replicates mean three measurements of each of 24 cases, not 72 independent benchmark examples per judge.

```bash
# plan + call estimate, no API
python -m evals.relational_agreement --dry-run

# score all 24 cases, both judges, 3 replicates, compared against retained Ragas obs
python -m evals.relational_agreement --judges kimi,openai --repeats 3 \
    --ragas-observations evals/reports/balanced_cases_observations.csv

# rebuild the report from a saved records CSV, no judge calls
python -m evals.relational_agreement --replay evals/results/relational/relational_observations_*.csv
```

Run from `backend/` with `KIMI_API_KEY` + `OPENAI_API_KEY` in the environment (or `backend/.env`). Raw per-call output (which may quote model claim text) is written to the gitignored `results/relational/*.jsonl` for local debugging only. Committed evidence — `reports/relational_grounded.md` and `reports/relational_grounded_observations.csv` — carries identifiers, labels, and numbers only, never questions, answers, or contexts.

## Langfuse score upload

`maybe_upload_to_langfuse` pushes document-level means to a `ragas_eval_aggregate` trace and creates one `ragas_eval_row` trace per golden row when `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`/`LANGFUSE_HOST` are set and valid. Row traces include question, document label, `concept_label`, generated answer, context count/chunk IDs when available, `retrieval_hit_at_k`, and row metric scores. They do not upload full retrieved chunk text by default.

## CI

`.github/workflows/ci.yml` runs the eval harness's **hermetic** tests (`evals/tests` + `tests/test_evals_review_fixes.py`) in the backend job with only `pandas`+`datasets` added — ragas-dependent tests `importorskip` there because ragas cannot coexist with the app's `openai==2.x` pin (see Environment above). The **live** Ragas run is deliberately NOT a CI gate: it needs real Qdrant/Supabase/Kimi/OpenAI keys, spends money, and takes ~30 min for 90 rows. Tracked in #83 as a scheduled/manual job with its own secrets + a dedicated eval venv.

## Cost

- Retrieval: low cost. Each row embeds the query with OpenAI and queries the existing Qdrant Cloud cluster; ingestion embeddings are already paid, but eval queries still perform embedding requests.
- Synthetic answer generation: 1 Kimi call per row.
- Judge: ~4 Kimi calls per row × 30 rows × 3 docs = ~360 Kimi judge calls per full run. Each ≤4k output tokens. Low cost, not free.
- Storage: CSV local. Langfuse Cloud free tier covers it.
