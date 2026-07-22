# Relation-aware grounded-correctness evaluator — design

Date: 2026-07-22
Branch: `agent/1/relation-aware-grounded-eval` (from `dev`)
Status: approved design, implementing.

## Problem

Ragas `faithfulness` decomposes an answer into independently-supported statements and
NLI-checks each against the retrieved contexts. That structure is blind to **relational**
errors: a reversed causal direction, a fact attributed to the wrong entity, a flipped
comparison, or a swapped number can leave every individual entity/statement "present" in
the context while the *combined meaning* is wrong. The committed balanced-case evidence
(`backend/evals/reports/balanced_cases_agreement.md`) documents exactly this: on the 24
balanced cases, faithfulness at threshold 0.5 catches almost no negatives (kimi neg-recall
0.083, openai 0.167; balanced accuracy ~0.54–0.58). The two `reverse_causal` cases are the
canonical blind spot.

## Goal

An **experimental, diagnostic** evaluator that judges whether the *complete meaning* of an
answer is supported by the retrieved contexts, in a single structured LLM call, and measure
it against the existing 24-case balanced calibration set with both judges (Kimi, OpenAI) at
≥3 repetitions. Diagnostic only — **no gate**, Ragas faithfulness stays, default judge
unchanged.

## Non-goals / guardrails

New files only under `backend/evals/` + `docs/`. Do **not** modify production retrieval,
generation, ingestion, chunking, golden data, Supabase, Qdrant, Langfuse behavior, current
pass bars, the default judge, or existing Ragas metrics. No gate is added. Ragas
faithfulness is not removed.

## Architecture

Two new modules + tests + reports + docs. Reuses the offline calibration harness end-to-end
so retrieval and generation stay fixed; everything measured is the evaluator.

### 1. `backend/evals/relational_eval.py` — evaluator core

Single-call structured evaluator. All app/openai imports lazy (module imports without keys;
tests stay hermetic). Raw `openai` SDK transport (no ragas/langchain) — runs in the app venv.

- Verdict constants: `SUPPORTED="supported"`, `PARTIALLY_SUPPORTED="partially_supported"`,
  `UNSUPPORTED="unsupported"`, and the sentinel `INSUFFICIENT_DATA="insufficient_data"`
  (assigned by the parser on failure — the model can never emit it).
- `@dataclass(frozen=True) RelationalResult`: `verdict`, `unsupported_claims: tuple`,
  `contradictions: tuple`, `relational_errors: tuple`, `reasoning_summary: str`,
  `confidence: Optional[float]`, `ok: bool`, `error: Optional[str]`, `raw: Optional[str]`.
- Output JSON schema the judge must return:
  `{"verdict","unsupported_claims","contradictions","relational_errors","reasoning_summary","confidence"}`.
  `reasoning_summary` is a **short audit explanation, not hidden chain-of-thought**; the
  prompt states this explicitly.
- `RUBRIC` (system prompt) explicitly checks: every factual claim; numbers/quantities; named
  entities; causal direction; comparisons; negation; temporal relationships; conjunctions
  that mix supported + unsupported claims; wrong-entity attribution; grounded-but-incomplete.
  Two load-bearing rules: **incompleteness alone is NOT unsupported** (a fully-grounded but
  partial answer is `supported`); **`partially_supported` is reserved for answers that mix
  supported and unsupported claims**, not for incompleteness. Grounded correctness is kept
  **separate from responsiveness** — the evaluator judges grounding only and emits no
  responsiveness score.
- `resolve_judge_config(judge) -> RelationalJudgeConfig` (pure): kimi → `KIMI_MODEL`,
  temp `KIMI_JUDGE_TEMPERATURE` (0.6), `base_url=KIMI_BASE_URL`,
  `extra_body={"thinking":{"type":"disabled"}}`, no seed; openai → `OPENAI_JUDGE_MODEL`
  (gpt-4o-mini), temp `OPENAI_JUDGE_TEMPERATURE` (0.0), `seed=OPENAI_JUDGE_SEED` (0). All
  constants imported from `evals.judges` / `evals.kimi_judge` / `app.services.llm` — single
  source of truth. Unknown judge → `JudgeError`. **Judge selection is always explicit.**
- `evaluate_relational(question, answer, contexts, *, judge, transport=None) -> RelationalResult`.
  Default transport does one `chat.completions.create(..., response_format={"type":"json_object"})`.
  Tests inject a fake `transport(config, system, user) -> str`.
- Defensive parsing: JSON-parse; verdict must be one of the three known values else
  `INSUFFICIENT_DATA` (reject unknown verdicts, never coerce to `supported`); transport
  error / non-JSON / non-object → `INSUFFICIENT_DATA`; lists coerced to `tuple[str,...]`;
  confidence clamped to `[0,1]` or `None`. **Malformed/missing → insufficient data, never
  silently supported.**
- `verdict_to_faithful(verdict) -> Optional[bool]`: `supported→True`,
  `partially_supported→False`, `unsupported→False`, `insufficient_data→None`.

### 2. `backend/evals/relational_agreement.py` — run + metrics + comparison

Mirrors `calibration_agreement.py`. Reuses `calibration_cases.materialise_cases`,
`calibrate.{BaselineRow, aggregate, Observation, read_observations_csv, RESULTS_DIR}`, and
`calibration_agreement.{ConfusionMatrix, faithfulness_class, confusion}`.

- `RelationalRecord` (per case×judge×replicate): `doc, case_id, judge, replicate, verdict,
  mapped_faithful: Optional[bool], confidence, n_unsupported, n_contradiction, n_relational,
  insufficient: bool`.
- `run_relational_cases(materialised, *, judges, repeats, evaluate=None) -> list[RelationalRecord]`.
  `evaluate` defaults to `evaluate_relational`; tests inject a fake.
- `case_prediction(records) -> Optional[bool]`: needs ≥2 valid (non-insufficient) replicates
  else `None` (insufficient). Prediction = majority of `mapped_faithful` across valid reps;
  tie → `False` (conservative). Keyed on `(doc, case_id)`.
- `build_confusion(records, cases_by_key, *, judge) -> ConfusionMatrix` (positive = faithful),
  giving positive/negative recall, FPR, FNR, balanced accuracy, insufficient_data count.
- Detection metrics by mutation family: relational-inversion (`reverse_causal`, expect 2),
  wrong-number (`replace_number`, expect 3), added-claim (`append_claim`+`combine`+`fabricate`,
  expect 7). For each, per judge: how many detected (majority prediction == unfaithful).
- `verdict_agreement(records, *, judge)`: per (case) modal-verdict fraction across reps;
  report mean fraction + unanimous count. Run-to-run stability.
- `confidence_calibration(records, cases_by_key, *, judge)`: mean confidence when the case
  prediction is correct vs incorrect, with counts.
- `missing_result_rate(records, *, judge)`: share of calls returning insufficient_data.
- Ragas comparison: `read_observations_csv(--ragas-observations)` → filter
  `metric=="faithfulness"` → `aggregate` → `confusion(..., metric="faithfulness",
  threshold=0.5)`. Placed side-by-side with the relational confusion. Apples-to-apples on the
  same 24 cases. `partially_supported` behaviour reported separately.
- Outputs (default `--out-dir = RESULTS_DIR/"relational"`, gitignored):
  - `relational_raw_{tag}_{stamp}.jsonl` — raw sanitized per-call output for debugging
    (contains model claim text; **local only, never committed**).
  - `relational_observations_{tag}_{stamp}.csv` — ids + verdict + numeric counts + confidence,
    **no free text** (safe to promote).
  - `relational_metrics_{tag}_{stamp}.csv` and `relational_grounded_{tag}_{stamp}.md`.
- CLI: `--cases --judges kimi,openai --repeats 3 --baseline-dir --ragas-observations
  --out-dir --tag --dry-run --replay`; `main(argv=None, *, evaluate=None)`.

### 3. `backend/evals/tests/test_relational_eval.py`

Hermetic (inject fake transport / fake evaluate; zero network). Proves the 11 required
behaviors (reversed causality, wrong numbers, appended claims, faithful→supported,
incomplete-but-grounded not unsupported-for-incompleteness, non-responsive-but-grounded stays
grounded, malformed→insufficient, (doc,case_id) attribution, missing replicates
excluded+reported, no retrieval/gen/Supabase/Qdrant/Langfuse calls, no text/secrets in
committed artifacts).

### 4. Reports + docs

Committed after the live run (privacy-safe numbers/ids only): `reports/relational_grounded.md`
+ `reports/relational_grounded_observations.csv`. README section. This design doc.

## Run plan + cost

Dry-run first (`--dry-run` prints plan + 24×J×R call estimate, no API). Live run: 24 cases ×
2 judges × 3 reps = **144 single structured calls**. Estimated < $0.50 total (OpenAI ~$0.03;
Kimi ~$0.18). Raw output saved to gitignored `results/relational/`.

## Verdict→label mapping validated against the real class balance

Faithful (12): identity 6, drop_sentence 3, evade_request 1, swap_question 2 → all expected
`supported`. Unfaithful (12): append_claim 3, combine 3, replace_number 3, reverse_causal 2,
fabricate 1 → all expected `partially_supported`/`unsupported`. The rubric's
incompleteness-rule keeps drop_sentence `supported`; the grounding/responsiveness separation
keeps evade_request and swap_question `supported`.

## What the report must answer

Detect both relational inversions? Reduce false positives on unfaithful answers? Preserve
recall on faithful answers? Which judge is better under this rubric? Stable enough for
diagnostic use? Strong enough for a regression gate? What failure modes remain?
