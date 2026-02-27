# Analytics Funnel Instrumentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add missing quiz funnel analytics events with consistent properties and dedupe so activation drop-off can be diagnosed.

**Architecture:** Emit events at the nearest reliable frontend lifecycle boundary using the existing `analytics.capture` wrapper. Keep creation events in the quiz hook, runtime question/session lifecycle events in the session page, and concept extraction in the dashboard. Use `useRef` gates and per-question sets to prevent duplicate firing.

**Tech Stack:** Next.js App Router, React hooks/effects, TypeScript, SWR, PostHog via `frontend/src/lib/analytics.ts`.

---

### Task 1: Update concept extraction event schema and dedupe

**Files:**
- Modify: `frontend/src/components/dashboard/DocumentDashboard.tsx`

**Step 1: Add dedupe ref and useRef import**
- Add `useRef` to React imports.
- Add `conceptsTrackedRef` boolean ref in component scope.

**Step 2: Emit `concepts_extracted` once with required property**
- In the existing ready-state effect, fire only when concepts are present and `conceptsTrackedRef` is false.
- Send `document_id` and `concept_count`.

**Step 3: Verify no duplicate emissions in code path**
- Ensure the effect cannot re-emit while component remains mounted for same document.

### Task 2: Split session creation from session start analytics

**Files:**
- Modify: `frontend/src/hooks/useQuiz.ts`

**Step 1: Replace event name at creation callsite**
- In `useCreateSession`, replace `quiz_session_started` with `quiz_session_created`.

**Step 2: Keep payload minimal and useful**
- Include `document_id` and `session_id` only.

### Task 3: Add runtime session funnel analytics in session page

**Files:**
- Modify: `frontend/src/app/session/page.tsx`

**Step 1: Add analytics import and dedupe refs**
- Import `analytics` and `useRef`.
- Add refs for `started`, `resumed`, `abandoned`, and `seenQuestionIds`.

**Step 2: Emit `quiz_session_started` at first question visibility**
- Add effect that fires once when question 1 is available for the session.
- Include `document_id`, `session_id`, `question_id`, `question_number`.

**Step 3: Emit `quiz_question_seen` per question once**
- Add effect keyed by current question id.
- Emit once per unique `question_id` using a `Set` ref.

**Step 4: Emit `quiz_resumed` when active in-progress session is loaded**
- Add effect firing once if `session.status === "active"` and `answered_questions > 0`.
- Include `document_id`, `session_id`, `question_id`, `question_number`.

**Step 5: Emit `quiz_abandoned` on tab hidden/pagehide before completion**
- Add `visibilitychange` + `pagehide` listeners.
- Fire once per page lifecycle only when session is not completed.
- Include `document_id`, `session_id`, and current `question_id`/`question_number` if available.

### Task 4: Build verification

**Files:**
- No code changes

**Step 1: Run production build**
- Run: `npm run build` from `frontend` in the worktree.

**Step 2: Confirm success**
- Expected: Next.js build completes without TypeScript or linting errors.

### Task 5: Report deliverables

**Files:**
- No code changes

**Step 1: Prepare requested output**
- Provide exact code insertions/locations.
- Provide event property schema for all six events.
- Explain event timing and dedupe behavior.
- Provide a concise commit message suggestion.
