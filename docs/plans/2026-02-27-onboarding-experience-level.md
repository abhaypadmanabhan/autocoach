# Onboarding Experience Level Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist onboarding `experience_level`, expose it through backend APIs, and identify users in analytics with that property after successful onboarding save.

**Architecture:** Add a nullable `experience_level` text column with a safe backfill and default. Keep API models backward compatible by introducing an optional field. Use dual-write (`experience_level` column + `learning_topics.experience_level`) and fallback reads to avoid breaking existing onboarding data. Trigger `analytics.identify` only after successful save.

**Tech Stack:** FastAPI, Pydantic, Supabase Postgres, Alembic, React/TypeScript, PostHog wrapper.

---

### Task 1: Database migration

**Files:**
- Create: `backend/alembic/versions/<new_revision>_add_experience_level_to_user_onboarding.py`

**Step 1:** Add nullable `experience_level` text column.

**Step 2:** Backfill existing rows where null to `'beginner'`.

**Step 3:** Set default `'beginner'` for future inserts.

### Task 2: Backend schema and route updates

**Files:**
- Modify: `backend/app/schemas/onboarding.py`
- Modify: `backend/app/api/routes/onboarding.py`
- Modify: `backend/app/db/models.py`

**Step 1:** Add optional `experience_level` to request/response schemas.

**Step 2:** Update GET route select and fallback logic:
- Prefer top-level column
- Fallback to `learning_topics.experience_level`
- Fallback to `'beginner'` for existing completed rows with missing data

**Step 3:** Update POST route to dual-write top-level and nested values without breaking partial update behavior.

### Task 3: Backend tests (TDD)

**Files:**
- Modify: `backend/tests/test_onboarding.py`

**Step 1:** Add failing assertions for `experience_level` in create/get/update flow.

**Step 2:** Run onboarding test to observe RED.

**Step 3:** Implement backend changes to turn GREEN.

**Step 4:** Re-run onboarding test.

### Task 4: Frontend onboarding and analytics identify

**Files:**
- Modify: `frontend/src/hooks/useOnboarding.ts`
- Modify: `frontend/src/components/onboarding/OnboardingModal.tsx`

**Step 1:** Extend onboarding types with optional `experience_level`.

**Step 2:** Submit `experience_level` top-level and keep nested `learning_topics.experience_level`.

**Step 3:** After successful onboarding save, call `analytics.identify(user.id, { experience_level })` and then continue navigation.

### Task 5: Verification

**Files:**
- No code changes

**Step 1:** Run backend onboarding test.

**Step 2:** Run a frontend static check (build or lint) to ensure TS compatibility.
