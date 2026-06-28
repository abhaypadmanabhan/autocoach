# Smart Review MVP — Design

**Status:** Approved 2026-06-27 (brainstorm). Awaiting implementation plan (writing-plans) when the fleet picks up the issue.
**Scope:** Make the existing-but-broken Smart Review feature functional end-to-end, with the simplest correct logic. Defer spaced-repetition intelligence.

## Problem

Smart Review looks built but is broken at the last mile:

- ✅ Due-concept **detection** works: `get_due_concepts()` (`backend/app/services/concepts.py:445`) returns concepts where `mastery_score < 75.0` **OR** `last_tested_at` older than 2 days, sorted weakest-first. Surfaced by `SmartReviewCard` (`frontend/src/components/dashboard/SmartReviewCard.tsx`) via `useReviewQueue()` → `GET /review/today`.
- ❌ The **review session is not wired.** `SmartReviewCard` links to `/session?mode=review`, but the session page does not handle `mode=review`, so clicking it never starts a review quiz.

Result: the user sees due concepts but cannot act on them.

## Locked decisions (from brainstorm)

1. **Ambition:** Wire the MVP with the existing simple due-concept logic. No SM-2/FSRS this pass.
2. **Question source:** Reuse the adaptive quiz engine, scoped to due concepts. Fresh LLM questions; no replay mechanism.
3. **Document scope:** A global "Review" button auto-picks the single document with the most due concepts and runs a per-document review there. Mechanics stay document-scoped (engine + RAG are already per-document).
4. **Quota:** Review is free — it does **not** consume the 5/day new-quiz quota. No new daily counter for MVP.

## UX flow

- **`SmartReviewCard` (dashboard):** shows `N concepts due` + the target document's title. Primary button: `Review weak spots (N)`. Hidden (or disabled) when `N == 0`.
- **Click →** backend creates a review session on the auto-picked document → frontend redirects to `/session?mode=review` (carrying the new `sessionId`).
- **Session page:** same quiz UI, but renders a `REVIEW` mono kicker instead of the standard one. Inherits the rotating learning-tips loader from backlog item #1 automatically (same session-create wait path).

## Backend mechanics

- **Endpoint:** extend `POST /quiz/sessions/` with an optional body field `mode: "standard" | "review"` (default `"standard"`). `user_id` still derived from token only.
- **On `mode == "review"`:**
  1. `get_due_concepts(user_id)` → group results by `document_id`.
  2. Pick the document with the most due concepts. Tie-break: most recently studied. Skip documents not in `ready` status or deleted.
  3. Create the session as normal, but set `session_type = 'review'` and seed the concept selector's focus pool to that document's **due `concept_id`s only**.
  4. **Skip `consume_quiz_usage_or_429`** (the free carve-out).
- **Concept selection during the session:** the mastery-weighted selector is restricted to the due-concept subset for the document; if that subset is exhausted before the session ends, fall back to the document's normal mastery-weighted pool.
- **Reused as-is:** question generation, the FSM (`pending → generating → ready → answered`, 30s stale-TTL), the latency-split answer path, and free-text answer evaluation.
- **Rate limiting:** keep the existing per-minute in-memory limiter on `/quiz/sessions/*` as a light abuse guard. No new daily counter.

## Data / schema

- **One migration:** add `quiz_sessions.session_type TEXT NOT NULL DEFAULT 'standard'` (values `'standard' | 'review'`). Drives the quota skip, the selector mode, and future analytics.
- **No new mastery columns** — the simple logic stays.
- **Retention loop is automatic:** review answers update `user_concept_mastery` (mastery rises, `last_tested_at` refreshes) through the existing `_update_concept_mastery` path, so reviewed concepts naturally drop out of the "due" set. No separate scheduler.

## Session length

- Up to `min(due_in_doc, 10)` questions.
- Ends when every due concept in the document has been asked once, or the 10-question cap is hit, whichever comes first.

## Edge cases

- **0 due concepts:** `SmartReviewCard` shows "All caught up" copy; the button is hidden.
- **Most-due document deleted or not `ready`:** fall through to the next-most-due document; if none qualifies, hide the button.
- **Tie on due count:** pick the most recently studied document.

## Out of scope (each → its own future issue)

- SM-2 / FSRS-lite spaced repetition (per-concept intervals, ease factors, decay curve).
- True cross-document review session (document-optional `quiz_sessions` + per-question RAG context).
- Replay-past-wrong-answers question source.
- Review-specific streak / XP mechanics.

## Synergy

Because review reuses the standard session-create path, it inherits backlog item #1 (rotating learning tips + launch-latency work) at no extra cost.

## Affected files (orientation, not exhaustive)

- `backend/app/api/routes/sessions.py` — accept `mode`, branch on review.
- `backend/app/services/session_manager.py` — `create_session` review branch, doc auto-pick, seeded selector.
- `backend/app/services/concepts.py` — reuse `get_due_concepts`; possible helper to group by document.
- `backend/app/db/models.py` + new alembic migration — `quiz_sessions.session_type`.
- `frontend/src/app/session/page.tsx` — handle `mode=review`, REVIEW kicker.
- `frontend/src/components/dashboard/SmartReviewCard.tsx` — wire button to create+redirect, empty state.
- `frontend/src/hooks/useQuiz.ts` — pass `mode` through `useCreateSession`.
