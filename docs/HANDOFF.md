# AutoCoach — Engineering Handoff (2026-05-08)

## Current State
- Stack: Vercel (frontend), Railway (backend FastAPI), Supabase (Postgres + auth), Qdrant Cloud (vectors)
- Backend URL: https://autocoach-production.up.railway.app
- Frontend URL: https://autocoach-rho.vercel.app
- Repo: github.com/abhaypadmanabhan/autocoach
- Migration head: `02968ade0f8e` (no migrations added today)
- Main HEAD: `5ad5964` — Kimi K2.6 spec doc commit (latest before this HANDOFF update)
- Branch state: `main` is clean. `feat/phase-1.7-langfuse` and `feat/kimi-k2.6-bump` merged + branches deleted (or about to be).

## Phase 1.7 — Where We Are Right Now
- **Backend instrumentation:** merged + deployed, running in **NOOP mode** in prod (langfuse SDK installed, 6 `@observe()` decorators applied to LLM + retrieval call sites, lifespan flush hook wired). `LANGFUSE_*` env vars are intentionally unset on autocoach Railway service — `_init_client()` short-circuits, decorators are pass-through.
- **Langfuse Railway stack:** **not yet deployed.** No traces being captured.
- **Spec ready:** `docs/specs/langfuse-selfhost.md` covers deployment topology, secrets, networking, retention, integration plan, verification, rollback.
- **Kimi model:** **K2.6 live in prod** (was on K2.5 yesterday). `KIMI_MODEL` constant in `backend/app/services/llm.py:15` flipped + 2-line `response.model` echo check warns on silent provider downgrade. Spec at `docs/specs/kimi-k2.6-migration.md`.
- **Next session picks up by:**
  1. Deploy Langfuse stack to Railway per `docs/specs/langfuse-selfhost.md` (Postgres + ClickHouse + Redis + Minio + langfuse-web + langfuse-worker via official template).
  2. Set `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` / `LANGFUSE_ENVIRONMENT=production` env vars on autocoach Railway service.
  3. Redeploy backend (env-var change triggers redeploy; no code change needed).
  4. Run spec §6 step 5 smoke test — first trace should automatically show `model=kimi-k2.6` because the constant is already live.

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
7. Langfuse: `embeddings.get_embeddings` `@observe` captures full 100×1536 float vectors per call (~600KB raw per trace). After Langfuse is live and trace size is measurable, set `capture_input=False, capture_output=False` on that decorator. Don't fix preemptively — verify it's actually a problem first.
8. App lifespan logs in `app/main.py` are swallowed in production — uvicorn's log capture on Railway only surfaces uvicorn's own logs and module-level errors. `logger.info()` calls inside the lifespan context manager don't appear. Pre-existing, not caused by Phase 1.7. Fix: configure `logging.basicConfig` with `force=True` or hook into uvicorn's logger. Low priority — only matters when we want to verify lifespan-time state from logs (e.g. Langfuse NOOP confirmation).
9. Pre-existing test failures surfaced during Phase 1.7 baseline run (filed in `tasks/bugs.md`):
   - `test_usage_limits::test_consume_quiz_usage_bypasses_limit_for_pro_user` — pro-bypass test hits real Supabase; FK violation. Pre-existing since 2026-02-16 (`66ead90`).
   - `test_usage_service::test_consume_quiz_usage_pro_bypass` — same root cause. Pre-existing since 2026-02-13 (`c890156`).
   - `test_xp_redemption::test_redeem_xp_refund_on_failure` — asserts 2 `users.update` calls, prod makes 3. Pre-existing since 2026-02-16 (`9b4cb5b`).
   - `test_onboarding::test_onboarding_flow` — missing `async_client` fixture. Pre-existing since 2026-02-23 (`4b18382`).
10. CI audit — confirm pytest runs on PR and blocks on failure. As of 2026-05-08 unknown whether `.github/workflows/*.yml` actually gates merges on the backend test suite. If not, the 4 pre-existing failures could mask real regressions. Inspect + harden as needed.
11. Quiz repetition issue (observed 2026-05-08) — multiple near-duplicate questions appearing within a single 10-Q session (e.g. RAG-components asked 3 times, Drop-D-Tuning verbatim-duplicated). Diagnosis blocked on Phase 1.7 traces being live so we can compare retrieved chunks across question generations. Re-investigate after Langfuse stack is deployed.
12. Langfuse SDK auth-warning per call — `WARNING:langfuse:Authentication error: Langfuse client initialized without public_key. Client will be disabled.` fires on every `@observe`-decorated call (not just at boot) because the SDK re-checks auth at each invocation when its internal singleton is unset. Cosmetic log noise only — NOOP behavior is correct. Silence later via `logging.getLogger("langfuse").setLevel(logging.ERROR)` once Langfuse stack is live (or before, if log volume is annoying).

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
