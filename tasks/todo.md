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

# Migrate Langfuse to Cloud free tier

**Status:** queued (not started) — added 2026-05-19
**Context:** Self-hosted Langfuse Railway stack decommissioned 2026-05-19 (was 94% of Railway
bill — ~$38/mo — for a zero-user app). Backend SDK is currently NOOP (no `LANGFUSE_*` keys).
This task restores observability at $0 via Langfuse Cloud free tier (50k observations/mo).

**Why now-deferred:** observability is not load-bearing while there are no users; eval work
(Phase 1.7 steps 5–7) needs a trace backend, so do this before that sprint resumes.

## Plan (env-only, no backend code change)
- [ ] Sign up at `cloud.langfuse.com`, create org + `autocoach` project
- [ ] Generate project API keys → store in 1Password (`pk-lf-...`, `sk-lf-...`)
- [ ] Set on autocoach Railway service env:
  - `LANGFUSE_HOST=https://cloud.langfuse.com` (US) or `https://eu.cloud.langfuse.com` (EU)
  - `LANGFUSE_PUBLIC_KEY=pk-lf-...`
  - `LANGFUSE_SECRET_KEY=sk-lf-...`
  - `LANGFUSE_ENVIRONMENT=production`
- [ ] Redeploy autocoach; confirm lifespan banner flips to `Langfuse: enabled`
- [ ] Smoke test: `POST /quiz/sessions/` → trace appears in Cloud UI within 30s
      (parent `quiz.generate_questions`, generation child tagged `model=kimi-k2.6`)
- [ ] Update CLAUDE.md + HANDOFF.md: NOOP → Cloud, drop "migration pending" notes

## Notes
- No code change: `backend/app/observability/langfuse.py` reads host from env, NOOP when keys absent.
- Old self-hosted trace history (2026-05-10 → 05-19) is NOT migrated — acceptable, dev-only data.
- The 6 Langfuse Railway services should already be deleted by then (manual teardown 2026-05-19).
