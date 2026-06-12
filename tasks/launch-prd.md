# AutoCoach Launch PRD — Parallel Agent Execution Plan

**Date:** 2026-06-11
**Source:** `tasks/launch-audit.md` (read it first — it has file paths, line numbers, and verified-safe context)
**Orchestrator:** Claude (PM). **Executors:** Agent A (Codex), Agent B (Cursor), Agent C (Antigravity/Gemini).

## Ground rules (all agents)

1. Create a git worktree off `main` with your assigned branch name. Do NOT work on `main` directly.
   ```bash
   git worktree add .worktrees/<branch-name> -b <branch-name> main
   ```
2. Touch ONLY the files listed in your scope. File ownership is exclusive — zero overlap by design. If you believe you must touch a file outside your scope, STOP and report back instead.
3. Backend conventions: every Supabase query via `supabase_admin` MUST filter `.eq("user_id", str(user_id))`. Python 3.12, FastAPI, pydantic v2.
4. Frontend conventions: Quiet Brutalism design system (see CLAUDE.md "Critical Gotchas") — zero radii, no blurred shadows, no gradients, mono for data, light-only. Do NOT add `ignoreCommand` to vercel.json.
5. Verification required before done:
   - Backend: `cd backend && source venv/bin/activate && pytest` (baseline: 65/66 pass; the 1 failure is `test_redeem_xp_refund_on_failure` which Agent A will FIX — after A's work it must be 66/66).
   - Frontend: `cd frontend && npx tsc --noEmit && npm run lint && npm run build`.
6. Commit in small logical commits, conventional-commit style. Do NOT merge — report done; human merges in PM-specified order.
7. Make every change minimal and surgical. No refactors, no drive-by cleanups, no new dependencies unless your scope explicitly says so.

---

## Agent A (Codex) — Backend hardening

**Branch:** `agent/backend-hardening`
**Owns files:** `backend/app/services/concepts.py`, `backend/app/services/quiz_generator.py`, `backend/app/api/routes/xp.py`, `backend/app/api/routes/documents.py`, `backend/app/models/quiz.py` (or new model file), backend tests.

### A1. Prompt-injection envelope for concept extraction
`concepts.py:146` embeds raw chunk text in the LLM prompt with no delimiters. Copy the exact pattern already used in `backend/app/services/answer_evaluator.py`: wrap untrusted content in tags, strip closing tags from content before embedding. Add a unit test with a chunk containing the closing tag + an instruction-like payload.

### A2. Validate LLM quiz output before DB insert
`quiz_generator.py:340-372` parses LLM JSON with no schema. Add a Pydantic model: max length caps on question_text (~2000) / options (~500 each, exactly 4 for MCQ) / correct_answer; `question_type` must be one of the enum values; `concept_id` must be in the requested concept set (allowlist passed in). On validation failure: log + retry once, then raise (existing error path). Unit tests: oversized field, bogus concept_id, wrong option count.

### A3. XP refund race (also fixes the 1 failing test)
`xp.py:83` refunds blindly. Add CAS guard: `.eq("total_xp", new_xp)` on the refund update. Run `pytest backend/tests -k xp` — `test_redeem_xp_refund_on_failure` must pass.

### A4. documents.py hardening (3 small items)
- `documents.py:240` — `if ".." in request.file_path: raise HTTPException(400)`.
- `documents.py:156` — return generic "Upload failed" to client, log real Supabase error server-side.
- `documents.py:149` — validate upload Content-Type against pdf/pptx allowlist (magic-byte check already exists downstream; this is belt-and-braces).

### A5. Kimi fallback for quiz generation (ops blocker)
Quiz generation is a single point of failure on Kimi. In `quiz_generator.py`, wrap the Kimi call: on exception, fall back to `call_openai` (same pattern as the free-text eval cascade in `answer_evaluator.py` / `llm.py`). Log a warning on fallback. Test: mock Kimi failure → OpenAI path used.

**Done =** 66/66 pytest green, all 5 items committed.

---

## Agent B (Cursor) — Frontend launch hardening

**Branch:** `agent/frontend-launch`
**Owns files:** `frontend/src/lib/analytics.ts`, `frontend/src/middleware.ts` (NEW — root proxy/middleware), `frontend/src/lib/validation/auth.ts`, `frontend/next.config.ts`, `frontend/src/app/settings/**` (opt-out toggle only).
**Note:** `frontend/src/lib/supabase/middleware.ts` already exists as a helper — check how it is wired before creating the root middleware; Next.js 16 may use `proxy.ts` naming. Verify against existing project setup.

### B1. Disable PostHog session recording
In `analytics.ts` PostHog init: add `disable_session_recording: true`. Biggest privacy exposure pre-launch.

### B2. Server-side route protection
No root middleware exists; protected pages rely on client checks. Create root middleware that uses the existing `frontend/src/lib/supabase/middleware.ts` session helper and redirects unauthenticated users to `/login` for: `/dashboard`, `/upload`, `/session/*`, `/settings`, `/results/*`, `/onboarding`. Leave `/`, `/login`, `/signup`, `/privacy`, `/terms` public. Make sure static assets/API routes excluded via matcher.

### B3. Password minimum 6 → 8
`validation/auth.ts:13` — raise min to 8. Placeholder already says "At least 8 characters". (Supabase server-side min is a human dashboard task, not yours.)

### B4. Security headers
`next.config.ts` — add `Strict-Transport-Security: max-age=63072000; includeSubDomains` and a conservative `Permissions-Policy` (camera=(), microphone=(), geolocation=()). Do NOT touch the existing CSP values.

### B5. Analytics opt-out toggle
Settings page: toggle that calls `posthog.opt_out_capturing()` / `opt_in_capturing()`, persisted via PostHog's own localStorage persistence. Style per Quiet Brutalism (mono label, square checkbox/toggle, no pills). Pairs with the privacy-policy claim of user choice.

**Done =** `npx tsc --noEmit` + lint + build green; manual check: logged-out hit to /dashboard redirects to /login.

---

## Agent C (Antigravity/Gemini) — Ops & data lifecycle

**Branch:** `agent/ops-launch`
**Owns files:** `backend/scripts/**` (NEW), `backend/app/main.py`, `backend/app/config.py`, `backend/requirements.txt`.

### C1. Account deletion admin script (launch blocker — GDPR fulfillment)
New `backend/scripts/delete_user.py`, runnable as `python -m scripts.delete_user <user_id_or_email> [--dry-run]`:
1. Resolve user by id or email via `supabase_admin.auth.admin`.
2. Collect user's document ids → delete Qdrant points for those documents (see deletion logic in `backend/app/api/routes/documents.py` DELETE handler for the existing pattern — reuse, don't reinvent).
3. Delete Supabase Storage objects under the user's path prefix.
4. Delete rows: chunks (via documents), documents, questions (via sessions), quiz_sessions, user_concept_mastery, user_daily_usage, user_onboarding, user_xp, user_documents_progress.
5. Delete auth user last.
`--dry-run` prints counts per table without deleting. Print summary. Must be idempotent (safe to rerun).

### C2. Sentry on backend (launch blocker — error visibility)
Add `sentry-sdk[fastapi]` to requirements. Init in `main.py` ONLY when `SENTRY_DSN` env is set (NOOP-when-unset, exception-safe — mirror the Langfuse singleton philosophy in `backend/app/observability/langfuse.py`). Add `SENTRY_DSN: str | None = None` + `ENVIRONMENT` passthrough in `config.py`. Add a line to the existing lifespan startup banner: `Sentry: enabled` / `disabled (no DSN)`. Do NOT touch anything else in main.py.

**Done =** pytest still green (no regressions), dry-run of delete script works against a test user, app boots with and without `SENTRY_DSN` set.

---

## NOT in scope for any agent (human/PM tasks)

- Legal draft edits (`/privacy`, `/terms`): jurisdiction, contact email, provider-training claim — Abhay.
- Supabase Auth dashboard: set min password length 8 — Abhay.
- PostHog dashboard: verify session recording off org-wide — Abhay.
- Sentry account + DSN into Railway env — Abhay (after C2 merges).
- Langfuse Cloud migration — separate task (`tasks/todo.md`), not launch-blocking once Sentry lands.

## Merge order (into `dev`)

1. **Agent A** (`agent/backend-hardening`) — largest backend surface, merge first.
2. **Agent C** (`agent/ops-launch`) — rebase on `dev` after A (different files, should be clean), merge second.
3. **Agent B** (`agent/frontend-launch`) — frontend-only, no conflict, merge last.

After all three on `dev`: PM (Claude) runs full verification — pytest 66/66, frontend build, deletion-script dry-run, header check — then final touches + `dev → main`.
