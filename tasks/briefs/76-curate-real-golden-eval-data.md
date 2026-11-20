# Issue #76 — Curate real golden eval data + first real Ragas run + CI gate

GitHub: https://github.com/abhaypadmanabhan/autocoach/issues/76

## Problem

The eval harness exists, but the golden data is still illustrative:

- `backend/evals/golden/*.config.json` still use placeholder document IDs.
- The three `backend/evals/golden/*.jsonl` files have only 1-2 sample tuples each.
- No real `python -m evals.run_ragas --doc all` baseline has been recorded.
- CI has a minimal pytest/type/lint gate, but Ragas is still separate from merge gating.

Do not fabricate ground-truth data. Real document IDs must come from uploaded, ready Supabase documents, and tuple content must be curated from the real PDFs/chunks.

## In-Scope Files

- `backend/evals/golden/ddia.config.json`
- `backend/evals/golden/attention.config.json`
- `backend/evals/golden/product_analytics.config.json`
- `backend/evals/golden/ddia.jsonl`
- `backend/evals/golden/attention.jsonl`
- `backend/evals/golden/product_analytics.jsonl`
- `backend/evals/results/*.csv`
- `backend/evals/README.md`
- `backend/evals/requirements.txt`
- `backend/evals/run_ragas.py`
- `backend/evals/config.py`
- `backend/evals/tuples_io.py`
- `backend/evals/tests/*`
- `.github/workflows/ci.yml`
- `tasks/todo.md`

## Out-of-Scope

- Frontend app files under `frontend/`.
- Backend product/API code under `backend/app/`.
- Alembic migrations under `backend/alembic/`.
- Mobile/iOS work under `ios/` and `.worktrees/feat-ios-mobile-app/`.
- Any unrelated cleanup outside the allow-list.

No other morning-patch agent owns files in this dispatch.

## Acceptance Criteria

- All three config files point at real `documents.id` UUIDs for uploaded, `ready` documents.
- Each golden JSONL file has 30 real curated tuples, for 90 total tuples.
- No placeholder UUIDs, sample-only tuples, or invented source text remain.
- A full `python -m evals.run_ragas --doc all` run completes and writes CSV output under `backend/evals/results/`.
- Langfuse Cloud score upload is confirmed when `LANGFUSE_*` is configured, or explicitly documented as skipped when not configured.
- CI is wired for pytest plus the eval/Ragas gate, or the Ragas CI gate is explicitly deferred with a focused follow-up and rationale.
- `tasks/todo.md` reflects the completed first real baseline run.

## Test / Verify Plan

- `cd backend`
- `python -m evals.run_ragas --doc all --limit 5`
- `python -m evals.run_ragas --doc all`
- `python -m pytest -q --ignore=tests/test_evals_review_fixes.py`
- `python -m pytest -q evals/tests`
- If CI changes: inspect `.github/workflows/ci.yml` for dummy-secret safety and no real credentials.

If the real PDFs, Supabase document IDs, or required env vars are unavailable, stop and report the blocker. Do not fill the golden set with synthetic content.
