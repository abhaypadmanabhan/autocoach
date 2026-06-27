# CTO Reconcile + Hygiene Sprint (2026-06-27)

**Mode:** plan-first. Nothing below executes until user approves. Scope locked by user:
(1) reconcile dev↔main, (2) fix stale-doc "lies" + investigate plan_type bug. No dead-code
deletion this pass (that goes to GitHub Issues for the fleet).

## Findings (verified read-only, 2026-06-27)
- `main` tree == `dev` tree (both `b791f3ba`). Divergence is **history-only**, content byte-identical.
  PR #15 squashed dev's launch-hardening onto main; dev kept granular commits. → reconcile is low-risk,
  zero content conflicts possible.
- Branches main / dev / feat/ios-mobile-app all intact, clean, synced to origin. One legit worktree (mobile).
- No `.github/workflows` — **zero CI**. Deploy = Railway + Vercel auto-deploy on push. (Out of scope this pass.)
- 0 open GitHub Issues; ~20-item backlog ready to port (separate pass).

## Step 1 — Reconcile dev↔main (back-merge, then fast-forward)
Trees identical, so merge produces no conflicts; main stays at the same content (Railway redeploy = no-op
alembic, just a restart). Pushing main is the one irreversible/prod-facing action — confirm before push.
- [ ] 1a `git checkout dev && git merge --no-ff main -m "chore: back-merge main (#15 squash + deploy trigger) into dev — content already in sync"`  (brings 0af92a5 + 82b3976 into dev ancestry)
- [ ] 1b `git checkout main && git merge dev`  (fast-forwards: dev now contains main → ff, main==dev)
- [ ] 1c verify: `git diff main dev` empty AND `git rev-parse main dev` equal
- [ ] 1d `git push origin dev` then `git push origin main`  ← prod deploy trigger; confirm first
- [ ] 1e post-deploy check: `curl .../health?deep=true` → 200, `railway run alembic current` → head

## Step 2 — Fix stale docs ("lies") + investigate plan_type
- [ ] 2a CLAUDE.md: delete the "migration 6e3be108bedc is buggy / missing DROP CONSTRAINT / WILL fail /
      Followup #1" gotcha. Verified false — DROP CONSTRAINT IF EXISTS present at lines 28-31 before the UPDATE.
- [ ] 2b CLAUDE.md: change "4 pre-existing failures in tasks/bugs.md" → "65 passed (bugs.md, resolved 2026-05-14)".
      Also note: `tasks/bugs.md` is gitignored yet referenced as tracked — decide track-or-stop-referencing.
- [ ] 2c HANDOFF.md: same two stale claims appear there — align.
- [x] 2d plan_type — **INVESTIGATED 2026-06-27, NOT A BUG.** Live probe (`railway run` vs prod Supabase):
      `users.plan_type` EXISTS, sample value `'free'`. `is_pro_user` works correctly. The subagent was wrong —
      it assumed SQLAlchemy models = source of truth, but the live `users` table carries columns alembic
      doesn't track. Live `users` cols: `avatar_url, created_at, email, full_name, id, last_sprint_date,
      plan_type, streak_count, total_xp, updated_at`. → **Real issue = schema drift** (live DB ⟂ ORM/migrations),
      NOT a broken Pro path. No code fix. Follow-up (→ Issue): add `plan_type` (+ other untracked cols) to
      `db/models.py` and a no-op alembic sync migration so a from-scratch rebuild matches prod. Tech-debt, P3.

## Deferred to GitHub Issues (NOT this pass)
- Dead code: legacy `/quiz/generate` route + 3 helpers; ~800 LOC frontend; dead DB columns.
- Scale: single-worker / blocking-sync-in-async; `time.sleep` long-poll; inline LLM in create_session.
- Stand up minimal CI (pytest + tsc + ruff/eslint) — prereq for the fleet workflow.
- Build `/morning-patch` orchestrator (see memory: fleet-orchestration-topology).

---

# Agent C — Ops & Launch Prep (2026-06-11)

- [ ] C1: Account deletion admin script (`backend/scripts/delete_user.py`)
- [ ] C2: Sentry backend integration (`backend/app/main.py`, `backend/app/config.py`, `backend/requirements.txt`)

---

# Sprint Resume Feature Plan

## Requirements
- Allow users to resume incomplete quiz sessions automatically.
- Tasks:
  1. On sprint page load: Check for existing session with status="in_progress"
  2. If exists: Load unanswered questions, navigate user to last question
  3. Track analytics event "quiz_resumed"
  4. If no session exists: Create new session
- Constraints: Use existing sprint/today endpoint, No duplicate sessions, Maintain question ordering

## Todo
- [x] Understand current `/sprint/today` endpoint (backend)
- [x] Understand current sprint page logic (frontend)
- [x] Formulate Implementation Plan
- [x] Verify plan with user

---

# Eval-First Roadmap (2026-05-30)

**Canonical plan:** this repo-visible roadmap section.
User picks: eval harness first, **strictly $0**, local-only, memory quick wins only,
no paid rerankers. Phased: P0 Langfuse Cloud → P1 Ragas → P2 latency profiling → P3 memory.

## Phase 0 — Langfuse Cloud (env-only, no code change)

**Why first:** all later eval scores attach to traces. NOOP path stays on until keys present.

- [ ] Sign up at `cloud.langfuse.com`, create org + `autocoach` project
- [ ] Generate project API keys (`pk-lf-...`, `sk-lf-...`)
- [ ] Set on Railway service + local `backend/.env`:
  - `LANGFUSE_HOST=https://cloud.langfuse.com` (or EU)
  - `LANGFUSE_PUBLIC_KEY=pk-lf-...`
  - `LANGFUSE_SECRET_KEY=sk-lf-...`
  - `LANGFUSE_ENVIRONMENT=production`
- [ ] Redeploy; confirm lifespan banner flips to `Langfuse: enabled`
- [ ] Smoke: `POST /quiz/sessions/` → trace in Cloud UI within 30s

## Phase 1 — Local Ragas harness

- [x] **1a scaffolding** — `backend/evals/golden/*.{config.json,jsonl}` templates, 2 seed tuples
      per doc (DDIA, Product Analytics, Attention)
- [x] **1b runner code** — `backend/evals/{run_ragas.py,kimi_judge.py,requirements.txt}`
- [x] **1c admin runbook** — appended Langfuse Cloud monitoring section to `docs/HANDOFF.md`
- [ ] **1a (user task):** upload the 3 PDFs in dev → paste real `documents.id` UUIDs into the
      `.config.json` files → hand-curate 30 tuples per doc
- [ ] **1b first run:** `pip install -r backend/evals/requirements.txt` then
      `python -m evals.run_ragas --doc ddia --limit 5` to smoke-test against live Qdrant
- [ ] Re-baseline metric bars after first real run

## Phase 2 — Latency profiling (no code surgery yet)

- [ ] Add `@observe(name=...)` spans on `ingestion.py` (extraction, chunking, embedding,
      Qdrant upsert) and `text_extraction.py` (per-page extract)
- [ ] Capture 10 ingestion runs (1, 5, 20, 50 pages) + 20 quiz turns
- [ ] Write `backend/evals/latency_report.md` with p50/p95 per stage from Langfuse
- [ ] **Check in.** Pick top hotspot before opening any code-change PR.

## Phase 3 — Memory quick wins

- [ ] **3a Semantic question dedup**
  - Alembic migration: `questions.question_embedding vector(1536)`
  - `session_manager._is_semantically_duplicate(question_text, session_id)` helper
  - `quiz_generator.generate_single_question` retries once if cosine > 0.85 vs last N
  - Integration test in `backend/tests/test_session_manager.py`
- [ ] **3b Wrong-answer bias**
  - `_select_next_concept` boosts ×1.3 for concepts with `is_correct=false` in last 10
  - Integration test

## Out of scope (deferred — see plan §"Out of scope")

- Reranker purchase (Cohere, Jina). BGE local documented as P4.
- FSRS spaced-repetition.
- Mem0-style fact memory (arxiv 2504.19413). Future P4.
- Hybrid retrieval (BM25 + dense).
- DeepEval / pytest CI gates.
- Frontend admin dashboard (Langfuse Cloud UI replaces).
