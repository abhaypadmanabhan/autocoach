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

**Canonical plan:** `/Users/abhayp/.claude/plans/i-want-you-to-binary-dove.md`.
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
