# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoCoach is an AI-powered tutoring app that turns documents (PDF, PPTX) into interactive adaptive quizzes via RAG.

**Tech Stack:**
- Frontend: Next.js 16 (App Router), React 19, TypeScript, TailwindCSS 4, SWR
- Backend: FastAPI, Python 3.11.9
- DBs: Supabase (Postgres + Auth + Storage), Qdrant Cloud (vectors)
- LLMs: Kimi K2.6 (primary, Moonshot first-party), OpenAI GPT-4o-mini (fallback)
- Embeddings: OpenAI `text-embedding-3-small` (1536 dim)
- Observability: Langfuse v4. Migrated to Langfuse Cloud free tier on 2026-07-01 (Issue #16). Tracing is fully enabled and instrumented via 6 `@observe()` decorators. Configured on Railway with production environment settings and locally for development.

**Hosting:**
- Frontend: Vercel (`https://autocoach-rho.vercel.app`)
- Backend: Railway (`https://autocoach-production.up.railway.app`). Self-hosted Langfuse stack that was co-located here was torn down 2026-05-19.
- Migration head: `02968ade0f8e`

## Commands

### Frontend (`/frontend`)
```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
npx tsc --noEmit # Type check
```

### Backend (`/backend`)
```bash
source venv/bin/activate
uvicorn app.main:app --reload  # Dev server at localhost:8000, docs at /docs
alembic upgrade head           # Run migrations (uses local DATABASE_URL)
pytest                         # Run tests (65 passed as of 2026-05-14; history in tasks/bugs.md)
```

## Architecture

### Document Processing Pipeline
```
Client upload → Supabase Storage → Backend register → Text extract (PDF/PPTX) → Chunk → OpenAI embeddings → Qdrant upsert
```
Document status: `pending` → `processing` → `ready` (or `failed`).
On ingestion, also: AI-generated title + concept extraction (top 20 chunks via Kimi).

### Adaptive Quiz Flow (latency-split)
1. `POST /quiz/sessions/` — creates session + first question (synchronous LLM call).
2. `POST /quiz/sessions/{id}/answer` — fast write (~250ms p50). MCQ/T-F evaluated inline; `text_free` evaluated via LLM (still inline, see Followup #2).
3. `GET /quiz/sessions/{id}/next` — long-polls for the *next* question, generated in background (FSM: `pending → generating → ready → answered`, 30s stale-TTL self-heals).
4. Question selection: mastery-weighted concept selector with `RECENT_ASK_WINDOW=3` dedup (PR #10) — excludes any concept asked in the last 3 answered Qs. Two-level fallback for tiny core pools.

### LLM Layer (`backend/app/services/llm.py`)
- `KIMI_MODEL` constant at `llm.py:15` — single-token revert path.
- `call_kimi` sends `extra_body={"thinking": {"type": "disabled"}}` (suppresses K2.6 reasoning output).
- `response.model` echo-check warns on silent provider downgrade.
- Free-text answer eval cascade: `call_kimi → call_openai` fallback.

### Auth Pattern
- Supabase Auth with JWT bearer tokens.
- Frontend middleware (`frontend/src/lib/supabase/middleware.ts`) refreshes session + protects routes.
- Backend dependency `get_user_id_from_token` validates token via `supabase_admin.auth.get_user(token)`. **`user_id` is always derived from the token**, never from request body.
- All backend queries use the **service-role client** (`supabase_admin`) and explicitly filter `eq("user_id", str(user_id))` — RLS is enforced at the route layer.
- `apiFetch<T>(path, options)` in `frontend/src/lib/api.ts` adds Bearer token.

### Observability (Langfuse)
- **Enabled.** Connected to Langfuse Cloud. Lifespan banner reads `Langfuse: enabled`. Traces are collected and sent to cloud.langfuse.com.
- Singleton client at `backend/app/observability/langfuse.py` — exception-safe constructor, host-agnostic. Configured via environment variables: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST`.
- Lifespan flush hook in `app/main.py`.
- `@observe()` decorators on: `quiz_generator.generate_quiz_questions`, `concepts.extract_concepts`, `answer_evaluator.evaluate_free_text`, `embeddings.get_embeddings`, `retrieval.retrieve_relevant_chunks`, `session_manager._update_concept_mastery`. Still in code, inert in NOOP mode.
- Lifespan banner: `Langfuse: enabled` (or `disabled (NOOP)`) — visible thanks to `logging.basicConfig(force=True)` in `main.py:28`.

### Background Tasks
- **Qdrant keep-alive** (PR #12): `qdrant_keepalive_loop` pings every `QDRANT_KEEPALIVE_INTERVAL_S` (default 300s) to prevent Cloud cluster suspension. Wrapped in `asyncio.to_thread`. Set env to `0` to disable. Per-replica + per-process (idempotent).

### Health Check
- `GET /health` — static 200 (cheap, used by Railway liveness probe).
- `GET /health?deep=true` (PR #11) — actively probes Qdrant + Postgres, returns 503 with per-dep `checks` map on degraded.

## Key Directories

```
frontend/src/
├── app/           # Next.js App Router: (auth), dashboard, upload, session, results, settings, onboarding
├── components/    # ui/ (shadcn), primitives-acx/ (custom OLED+Geist primitives), auth/
├── hooks/         # useQuiz, useDocuments, useUploadDocument, useDocumentProgress, useReviewQueue,
│                  # useOnboarding, useConcepts, useAvatar, useDailySprint, useToast
└── lib/           # api.ts, analytics.ts (PostHog), supabase/, validation/, types.ts, motions.ts,
                   # date.ts, errorMessages.ts, milestones.ts, utils.ts

backend/app/
├── api/routes/    # health, documents, quiz, sessions, concepts, review, xp, onboarding
├── services/      # ingestion, text_extraction, chunking, embeddings, retrieval,
│                  # quiz_generator, session_manager, answer_evaluator, concepts,
│                  # llm, usage, abuse_controls
├── observability/ # langfuse.py (singleton + lifespan flush)
├── core/          # supabase.py (admin + public clients), qdrant.py (client + keepalive), rate_limit.py
├── db/            # SQLAlchemy base + models (alembic target)
├── models/        # Pydantic models (quiz.py, documents.py)
├── schemas/       # onboarding schemas
├── config.py      # Settings (pydantic-settings, .env-driven)
└── main.py        # FastAPI app, lifespan, CORS, router wiring
```

## API Endpoints (full list)

**Health**
- `GET /health` (+ `?deep=true`)

**Documents** (prefix `/documents`)
- `POST /upload` — backend-side upload + process
- `POST /register` — register a client-uploaded blob (Supabase Storage path)
- `GET /` — list user docs
- `GET /{id}` — single doc
- `GET /{id}/concepts` — extracted concepts
- `POST /{id}/search` — RAG search within doc
- `DELETE /{id}` — delete doc + chunks + Qdrant points
- `GET /progress/summary` — aggregate progress
- `GET /{id}/progress` — per-doc progress

**Quiz** (prefix `/quiz`)
- `POST /generate` — one-shot quiz generation (legacy)

**Quiz Sessions** (prefix `/quiz/sessions`)
- `POST /` — create session + first question
- `GET /{id}` — session status
- `GET /{id}/current` — current unanswered question
- `POST /{id}/answer` — submit answer (fast path, ~250ms p50)
- `GET /{id}/next` — long-poll for next question

**Other**
- `GET /review/today` — review-queue items
- `POST /xp/redeem` — redeem 100 XP for an extra quiz credit
- `GET /onboarding`, `POST /onboarding`

## Database Tables (Supabase)

Core:
- `documents` — user_id, filename, file_type, status, chunk_count, ai_title
- `chunks` — document_id, content, chunk_index, embedding_id
- `quiz_sessions` — user_id, document_id, status, total_questions, correct_answers
- `questions` — session_id, `question_type` (real Postgres enum: `text_free`/`text_mcq`/`text_tf`/`rendered`), question_text, options, correct_answer, user_answer, is_correct, focus_concept_id, status (FSM), `render_kind` + `render_payload jsonb` (Phase 2 placeholders, currently unused)
- `concepts`, `user_concept_mastery` — adaptive selector inputs
- `user_daily_usage` — per-day quota tracking
- `user_onboarding`
- `user_xp` — XP balance
- `user_documents_progress`

Orphan (no code refs, intentionally left in DB by PR3): `daily_sprints`.

## Environment Variables

Required in `.env`:
```
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
QDRANT_URL, QDRANT_API_KEY
KIMI_API_KEY, OPENAI_API_KEY
```

Optional:
```
LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST, LANGFUSE_ENVIRONMENT   # fully configured on Railway (production) and locally (development).
QDRANT_KEEPALIVE_INTERVAL_S=300         # 0 disables
GENERATION_STALE_TTL_SECONDS=30         # FSM self-heal threshold
NEXT_QUESTION_MAX_WAIT_MS=10000         # long-poll cap
FRONTEND_ORIGINS=...                    # comma-separated CORS allowlist
ENVIRONMENT=development|production
```

Frontend needs `NEXT_PUBLIC_BACKEND_URL` and Supabase publishable keys.

## Critical Gotchas (read before touching anything)

- **`vercel.json` has NO `ignoreCommand`** — DO NOT add one. Previous attempt silently skipped every deploy for weeks.
- **`railway.toml` startCommand auto-runs alembic on every deploy.** CWD is `backend/` (per nixpacks Python inference). DO NOT add `cd backend &&`.
- **Alembic uses `SUPABASE_POOLER_URL`** (Session pooler, port 5432, IPv4) NOT `DATABASE_URL` (direct host, IPv6, unreachable from Railway egress). Fallback chain in `backend/alembic/env.py`.
- **CSP set in `frontend/next.config.ts` only.** Allows: Railway backend, Supabase, PostHog (`us.i.posthog.com`, `us-assets.i.posthog.com`). Do not add `app.posthog.com`.
- **Migration `6e3be108bedc` drops the stale Supabase CHECK** (`DROP CONSTRAINT IF EXISTS questions_question_type_check`, lines 28-31) before backfilling the enum — idempotent, safe on fresh + already-migrated DBs. (Previously flagged here as missing this; verified present 2026-06-27, gotcha was stale.)
- **`render_kind`/`render_payload` columns** exist but unused until Phase 2 (Mermaid + Plotly).
- **Service-role client bypasses RLS** — every backend query MUST `.eq("user_id", str(user_id))`. Audit any new route.
- **In-memory rate limiter (`core/rate_limit.py`) is per-worker** — multi-replica deploys multiply the effective limit. Daily quotas (Postgres-backed) are the real gate.
- **Frontend design system is "Quiet Brutalism" (Padzy OS), light-only** — warm cream `#F9F1E6` ground, ink `#171717`, single emerald accent `#109462`, error `#C2402A`. Fonts: Space Grotesk (display) / Inter (body) / Space Mono (all data) via `next/font/google`. ALL radii are 0 (zeroed in `globals.css` `@theme`). Hard offset shadow (`.shadow-hard`, 4px ink, zero blur) is reserved for primary CTA buttons + the active quiz card ONLY. No blurred shadows, gradients, `backdrop-blur`, pills, or dark mode (next-themes removed). Any future `shadcn add` pulls rounded/shadowed defaults — audit and brutalize before committing. Status = mono text + dot (`StatusPill`), section labels = numbered mono kickers (`.kicker`, e.g. `01 / DASHBOARD`), active state = 2px green left tick.

## Specs

- `docs/specs/langfuse-selfhost.md` — Phase 1.7 self-hosted Langfuse on Railway. **SUPERSEDED 2026-05-19** — stack decommissioned on cost grounds; kept for history only.
- `docs/specs/kimi-k2.6-migration.md` — K2.5 → K2.6 model bump
- `docs/HANDOFF.md` — engineering handoff, "Phase 1.7 — Where We Are Right Now" is the canonical session-start read
- `tasks/bugs.md` — test-failure tickets, all resolved 2026-05-14 (65 passed). NOTE: gitignored, absent in fresh clones
- `tasks/lessons.md` — captured corrections (per global instructions)

## Phase 1.7 Status (current sprint — Eval & Observability)

Done:
1. ~~Self-hosted Langfuse on Railway~~ — decommissioned 2026-05-19. Migrated to Langfuse Cloud free tier on 2026-07-01. ✅
2. `@observe()` instrumentation on 6 LLM + retrieval call sites ✅
3. Smoke-test traces visible in UI (parent + generation child, env+release tags) ✅ — verified on Langfuse Cloud.

Next:
4. Golden eval set: 3 PDFs (DDIA, Product Analytics, Attention Is All You Need) × 50 (question, source_chunk, ideal_answer) tuples
5. Ragas integration (faithfulness, context_recall, context_precision)
6. Hand-grade 50 answers for human-vs-LLM-judge agreement
7. DeepEval pytest CI gates
8. Chunking sweep (size 200/500/1000 × overlap 0/50/100)
9. Optional: hybrid retrieval (BM25 + dense) for recall@5 > 0.85

## Active Branches

- `main` — production
- `feat/ios-mobile-app` — full iOS mobile app (worktree at `.worktrees/feat-ios-mobile-app/mobile/`, Expo SDK 55, NativeWind v4 + TailwindCSS v3)

## How To Verify Prod Is Healthy (5-min check)

1. `curl https://autocoach-production.up.railway.app/health` → 200
2. `curl 'https://autocoach-production.up.railway.app/health?deep=true'` → 200 with `checks: {qdrant: ok, postgres: ok}`
3. `railway run alembic current` → `02968ade0f8e`
4. Open https://autocoach-rho.vercel.app/ in incognito → no console errors, login works
5. Upload small PDF → wait ready → Start Quiz → answer 2 questions (Langfuse trace check N/A until Cloud migration — see `tasks/todo.md`)
