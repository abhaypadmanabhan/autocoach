# AutoCoach — Engineering Handoff (2026-05-10)

> **UPDATE 2026-05-19 — Self-hosted Langfuse decommissioned.** The co-located Langfuse Railway stack (langfuse-web, langfuse-worker, Postgres, ClickHouse, Redis, MinIO) was 94% of the Railway bill (~$13/cycle, est. ~$38/mo) for a zero-user app. Stack torn down; `LANGFUSE_*` env vars removed from autocoach Railway service → backend SDK runs NOOP, zero observability cost. `docs/specs/langfuse-selfhost.md` is SUPERSEDED. Replacement = Langfuse Cloud free tier, tracked in `tasks/todo.md` (not yet executed). Everything below this banner reflects pre-2026-05-19 state.

## Current State
- Stack: Vercel (frontend), Railway (backend FastAPI), Supabase (Postgres + auth), Qdrant Cloud (vectors)
- Backend URL: https://autocoach-production.up.railway.app
- Frontend URL: https://autocoach-rho.vercel.app
- ~~Langfuse UI: https://langfuse-web-production-31ed.up.railway.app~~ — self-hosted stack removed 2026-05-19 (see banner above)
- Repo: github.com/abhaypadmanabhan/autocoach
- Migration head: `02968ade0f8e` (no migrations added today)
- Main HEAD: `f9af8b9` (latest before this HANDOFF commit)
- Branch state: `main` is clean. Today's PRs merged: #9 lifespan-log-fix, #10 quiz-dedup, #11 health-deep, #12 qdrant-keepalive.

## Phase 1.7 — Where We Are Right Now
- **Backend instrumentation:** merged + deployed, **LIVE** in prod. `LANGFUSE_*` env vars set on autocoach Railway service. Lifespan banner flips to `Langfuse: enabled` (visible thanks to the `force=True` basicConfig fix from PR #9). 6 `@observe()` decorators emitting traces.
- **Langfuse Railway stack:** ~~deployed 2026-05-10~~ — **DECOMMISSIONED 2026-05-19** (see banner at top of file). 6 services (langfuse-web, langfuse-worker, Postgres, ClickHouse, Redis, MinIO) torn down on cost grounds. Backend SDK now NOOP.
- **Smoke test:** **passed** (2026-05-10). User observed traces in UI: parent `quiz.generate_questions`, generation child tagged `model=kimi-k2.6`, `environment=production`, `release=<git sha>`. No instrumentation exceptions.
- **Spec status:** `docs/specs/langfuse-selfhost.md` **executed end-to-end**. Open question §9.4 resolved — health body shape is `{"status":"OK","version":"3.<minor>.<patch>"}`.
- **Kimi model:** K2.6 still live (no changes today).
- **Next session picks up Phase 1.7 step 3+:** golden eval set construction (3 PDFs × 50 (question, source_chunk, ideal_answer) tuples), Ragas integration, hand-grade for human-vs-LLM-judge agreement.
- **2026-05-30 update:** plan rewritten to "eval-first, $0, local-only." See `/Users/abhayp/.claude/plans/i-want-you-to-binary-dove.md`. Phase 1.7 step 1 (self-hosted Langfuse) replaced by Langfuse Cloud free tier. Golden set sized down to 30/doc. Ragas runner scaffolded at `backend/evals/` (see below).

## Admin Monitoring (Langfuse Cloud + Ragas, $0)

For a zero-user app, there is no separate admin dashboard or metrics export. The monitoring surface is the **Langfuse Cloud UI** plus a local Ragas runner. Both are free.

**Day-to-day "is RAG healthy?" checks:**
1. **Trace latency** — Langfuse Cloud → Sessions → sort by latency desc. Look at `quiz.generate_questions` and `retrieval.qdrant` spans. p50 budgets to watch: ingestion `<10s` for ≤20-page PDFs; `retrieval.qdrant` `<500ms`; `quiz.generate_questions` `<3s`.
2. **Retrieval quality** — Langfuse Cloud → Scores tab → filter by `ragas_eval` trace tag. `context_recall` and `context_precision` are the headline retrieval-quality numbers. Re-run `python -m evals.run_ragas` weekly and watch the trend.
3. **Answer quality** — same Scores tab, `faithfulness` and `answer_relevancy`. Drops here mean either retrieval is feeding garbage chunks or the LLM is going off-script.
4. **Regression spotting** — Langfuse Cloud has week-over-week metric charts on the Dashboards tab. A sudden p95 spike on `quiz.generate_questions` is usually Kimi rate-limiting or a slow Qdrant region.

**One-shot baseline** (after `LANGFUSE_*` keys are set and golden set is curated):
```bash
cd backend && source venv/bin/activate
pip install -r evals/requirements.txt          # one-time
python -m evals.run_ragas --doc all
```
Check `backend/evals/results/*.csv` for the per-row breakdown, and the `ragas_eval` trace in Langfuse Cloud for the aggregate.

## Active Bug — Diagnosed, Fix Shipped
- **Quiz repetition (HANDOFF #11, original):** within a single 10-Q session, the selector handed the generator the same `focus_concept_id` 3+ times (RAG-components 3×, Drop-D-Tuning verbatim duplicate). Diagnosed via Langfuse trace 2026-05-09: same `concept_id` arg across consecutive `quiz.generate_questions` spans → selection-side, not extraction or generation.
- **Root cause:** selector only deprioritized after 3 trailing **correct** answers. A high-importance / low-mastery concept could be picked back-to-back, and the miss-streak boost (×2 weight after a wrong answer) actively re-amplified it.
- **Fix shipped (PR #10):** new `RECENT_ASK_WINDOW=3` excludes any concept asked in the last 3 answered Qs. Two-level fallback for tiny core pools. `MISS_STREAK_DECAY` boost dropped (its slice was always inside the recent-asked window post-fix → dead code; AND it was contributing to the original bug).
- **Verification pending:** trigger a new 10-Q session against the original repeating doc; pull trace; confirm `focus_concept_id` differs across consecutive `quiz.generate_questions` spans.

## What Shipped 2026-05-10 (4 PRs, all merged to main)
- **PR #9** (`fix/lifespan-log-visibility`): `logging.basicConfig(force=True)` in `app/main.py` so the lifespan banner surfaces under uvicorn on Railway. Fixes HANDOFF #8. Without this, Step 3 banner-flip verification (`Langfuse: enabled` vs `disabled (NOOP)`) wouldn't have been visible.
- **PR #10** (`fix/quiz-dedup-recent-window`): selector-side dedup. New `RECENT_ASK_WINDOW=3` in `session_manager.py`. Dropped `MISS_STREAK_DECAY` boost. 2 new tests + 1 updated + 1 removed. Fixes the original HANDOFF #11 quiz repetition bug.
- **PR #11** (`feat/health-deep-checks`): `/health?deep=true` probes Qdrant + Postgres, returns 503 with per-dep `checks` map on degraded. Default `/health` unchanged (static 200). 4 new tests.
- **PR #12** (`feat/qdrant-keepalive`): background asyncio loop pings Qdrant every `QDRANT_KEEPALIVE_INTERVAL_S` (default 300s) to prevent Cloud cluster suspension. Wrapped in `asyncio.to_thread` so it doesn't block the event loop. Set env var to 0 to disable. 3 new tests.

## What Shipped 2026-05-08 (combined push — 8 commits)
- **Phase 1.7 instrumentation merge** (`cb9a3bd`):
  - **`65c6ec7`** — scaffold: `langfuse>=4.5,<5` (resolved to 4.6.1) added to requirements, 4 `LANGFUSE_*` settings fields, `backend/app/observability/langfuse.py` singleton (NOOP-when-keys-missing, exception-safe constructor, kwargs-only init), lifespan flush hook in `app/main.py`. 8 tests.
  - **`01f4092`** — review fixes: drop `os.environ` writes, wrap constructor in try/except, drop `_coerced_str` shim by fixing 2 upstream MagicMock-leaking tests. +2 tests.
  - **`26747c6`** — `@observe()` on 6 call sites: `quiz_generator.generate_quiz_questions`, `concepts.extract_concepts`, `answer_evaluator.evaluate_free_text`, `embeddings.get_embeddings`, `retrieval.retrieve_relevant_chunks`, `session_manager._update_concept_mastery`.
  - **`58eb473`** — spec doc `docs/specs/langfuse-selfhost.md`.
- **`3ad2e64`** — spec correction: concept-extraction call site path (`extract_concepts_from_content` → `concepts.extract_concepts`).
- **`30bf2fe`** — Kimi `K2.5 → K2.6` model bump. 1-line constant change + 2-line `response.model` echo check (uses `KIMI_MODEL` constant so future bumps are single-token).
- **`5ad5964`** — spec doc `docs/specs/kimi-k2.6-migration.md`.

### Verification (post-deploy 2026-05-08)
- `/health` HTTP 200 ✅
- `POST /quiz/sessions/` HTTP 200 ✅ — quiz generation works against K2.6
- `POST .../answer` HTTP 200 ✅ — eval round-trip works
- No `Kimi response model=... expected kimi-k2.6` warning fired → K2.6 confirmed served (no silent downgrade)
- No Langfuse exceptions, no Tracebacks
- Pytest: 57 passed / 3 failed / 1 error (pre-existing failures filed in `tasks/bugs.md`)

## What Shipped Earlier (5 PRs, pre-2026-05-08)
- **PR1 (#4):** Deleted ~20K LOC dead code (mobile/, next-app/, dev/blocks, daily-sprint, analytics, config, feedback, voice, summary_generator, etc.)
- **Hotfix (b02bb80):** Removed orphan `DocumentSummary` component refs causing TypeError on prod
- **PR2 (#5):** Adaptive loop — mastery-weighted question selection. Question type formalized as Postgres enum (`text_free`/`text_mcq`/`text_tf`/`rendered`). Render columns added (`render_kind`, `render_payload jsonb`) but unused.
- **PR3 (#6):** Cleanup of orphan backend routes (`daily_sprint`, `sprints`) + `summary_*` columns dropped
- **PR4 (#7):** Latency split — submit/next endpoints. `POST /quiz/sessions/{id}/answer` returns fast (~250ms p50). `GET /quiz/sessions/{id}/next` long-polls for background-generated question. Question lifecycle FSM (pending → generating → ready → answered) with 30s staleness TTL self-healing.
- **PR5 (#8):** Document detail page wired to adaptive session. Single Start Quiz CTA. Old dead buttons killed (Train Weak, Quiz Concept, Continue Learning).

## Architecture Decisions Made Today
- **User persona:** CS/coding-doc students (provisional, validated by golden-set picks: DDIA, Product Analytics, Attention paper)
- **Philosophy:** "Doing first, learn by mistakes" — no reading mode, no summaries, fight the material from Q1
- **Question generation:** ON-DEMAND per question (not pre-batched). Mastery from previous answer feeds selection of next question.
- **Render types planned:** Mermaid + Plotly (Phase 2), code execution sandboxes (Phase 3)
- **Temporal:** deferred to Phase 4 (or never) — only worth it for multi-step generation pipelines
- **Observability:** self-hosted Langfuse + Ragas + DeepEval (NOT LangSmith — cost + open-source preference). Plan: separate Railway project for Langfuse stack via official template.

## Critical Gotchas (Read Before Touching Anything)
- **`vercel.json` has NO `ignoreCommand`.** DO NOT add one. Previous attempt broke prod for weeks (every commit silently skipped). Build every commit.
- **`railway.toml` startCommand auto-runs alembic on every deploy.** CWD is `backend/` (per nixpacks Python inference). DO NOT add `cd backend &&` — that breaks prod, twice today.
- **Alembic uses `SUPABASE_POOLER_URL`** (Session pooler, port 5432, IPv4) NOT `DATABASE_URL` (direct host, IPv6, unreachable from Railway egress). Fallback chain in `backend/alembic/env.py`.
- **CSP set in `frontend/next.config.ts` only.** Allows: Railway backend, Supabase, PostHog (`us.i.posthog.com` + `us-assets.i.posthog.com`). Do not add `app.posthog.com` (not needed).
- **`question_type` column is now real Postgres enum (`question_type_enum`).** Old migration `6e3be108bedc` is buggy: missing `DROP CONSTRAINT IF EXISTS questions_question_type_check` before UPDATE. Fresh deploys to clean DBs WILL fail. Fix as small ticket.
- **Render columns (`render_kind`, `render_payload`)** exist in schema but unused until Phase 2 ships executable questions.

## Known Followups (file as TODO/ticket, not blocking)
1. Fix migration `6e3be108bedc` — add `DROP CONSTRAINT IF EXISTS` as first line of `upgrade()`
2. Move `text_free` answer eval to background (currently ~2s p50 inline; PR4 didn't background it)
3. Drop orphan `daily_sprints` table (intentionally left in DB by PR3, no code references)
4. Harden `useUploadDocument.ts:90,93` — `.includes()` defensive pattern same as the bug we fixed in `useDocumentSummary`
5. Add latency telemetry in prod (validate p50/p95 estimates from PR4 spec — submit ~250ms, `GET /next` median wait, etc.)
6. Dashboard root cleanup — audit `WeakConceptsWidget` for orphan endpoints, kill if dead (was out of scope for PR5)
7. Langfuse: `embeddings.get_embeddings` `@observe` captures full 100×1536 float vectors per call (~600KB raw per trace). Now that Langfuse is live, measure actual trace size; if problematic, set `capture_input=False, capture_output=False` on that decorator. Don't fix preemptively.
8. ~~App lifespan logs swallowed in production~~ — **fixed PR #9 (2026-05-10)**.
9. Pre-existing test failures (filed in `tasks/bugs.md`):
   - `test_usage_limits::test_consume_quiz_usage_bypasses_limit_for_pro_user` — pro-bypass test hits real Supabase; FK violation. Pre-existing since 2026-02-16 (`66ead90`).
   - `test_usage_service::test_consume_quiz_usage_pro_bypass` — same root cause. Pre-existing since 2026-02-13 (`c890156`).
   - `test_xp_redemption::test_redeem_xp_refund_on_failure` — asserts 2 `users.update` calls, prod makes 3. Pre-existing since 2026-02-16 (`9b4cb5b`).
   - `test_onboarding::test_onboarding_flow` — missing `async_client` fixture. Pre-existing since 2026-02-23 (`4b18382`).
10. CI audit — confirm pytest runs on PR and blocks on failure. As of 2026-05-10 still unverified whether `.github/workflows/*.yml` gates merges on the backend test suite. If not, the 4 pre-existing failures could mask real regressions.
11. ~~Quiz repetition~~ — **diagnosed + fixed PR #10 (2026-05-10)**. Verify after a fresh 10-Q session against the original repeating doc — confirm `focus_concept_id` differs across consecutive `quiz.generate_questions` spans in Langfuse.
12. ~~Langfuse SDK auth-warning per call~~ — **self-resolved**. NOOP-mode warnings stopped firing once we left NOOP. Future-proof only if creds get rotated wrong; not worth pre-silencing.
13. **New:** Qdrant Cloud cluster suspension — keep-alive (PR #12, default 5min ping) prevents it but is per-replica + per-process. If autocoach scales to multiple workers, multiple pings (idempotent). If we move off Cloud free tier, drop the keep-alive.

## Phase 1.7 Plan (Next Sprint — Eval & Observability)
Deliverables in order:
1. Self-host Langfuse on Railway (separate project, official template) — Postgres + ClickHouse + Redis + Minio + langfuse-web + langfuse-worker
2. Wire `@observe()` decorators on all LLM + retrieval calls in backend
3. Build golden eval set:
   - 3 PDFs: Designing Data-Intensive Applications, Product Analytics for Dummies, Attention Is All You Need
   - 50 (question, source_chunk, ideal_answer) tuples
4. Ragas integration: faithfulness, context_recall, context_precision metrics
5. Hand-grade 50 answers for human-vs-LLM-judge agreement metric
6. DeepEval pytest CI gates blocking quality regressions
7. Tune chunking via eval sweep (size 200/500/1000 × overlap 0/50/100)
8. Optional: hybrid retrieval (BM25 + dense) to push recall@5 past 0.85

Target resume claims to defend with real numbers:
- recall@5: 0.75 → 0.88
- hallucination rate: 15% → <5%
- LLM judge cost reduction: 50–65% via Kimi → GPT-4o-mini cascade
- Human agreement: 80–88% on 50-sample hand-graded set

## Phase 2+ Roadmap (After 1.7)
- **Phase 2:** Mermaid + Plotly render types (CS diagrams + data viz). Iframe sandbox + `srcdoc` + `postMessage` architecture.
- **Phase 3:** Code execution sandboxes (sql.js for SQL questions, Pyodide for Python data analysis)
- **Phase 4:** Maybe Temporal for multi-step question generation pipelines (only if executable questions prove the moat)

## Local Dev Setup Notes
- frontend: `cd frontend && npm install && npm run dev`
- backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
- Migrations locally: `cd backend && alembic upgrade head` (uses local `DATABASE_URL`)
- Tests: `cd backend && pytest`
- Frontend types: `cd frontend && npx tsc --noEmit`

## How To Verify Prod Is Healthy (5-minute check)
1. `curl https://autocoach-production.up.railway.app/health` → expect 200
2. `railway run alembic current` → expect `02968ade0f8e`
3. Open https://autocoach-rho.vercel.app/ in incognito → no console errors, login works
4. Upload a small PDF → wait for processing → click document → see Start Quiz CTA → click → answer 2 questions
5. Submit Q1 latency: should feel <1s

## Communication Pattern That Worked
- Spec-first for any non-trivial change (superpowers workflow)
- One PR at a time, stacked branches with linear rebases
- Verify each PR's deploy + migration before merging next
- Don't trust the "Vercel ✅" check — verify build ID flipped + curl real endpoints
- Hot-revert immediately if prod breaks; diagnose after
