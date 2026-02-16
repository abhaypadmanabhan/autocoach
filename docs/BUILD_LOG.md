## Sprint 1 – Weak Concepts Loop
- Implemented `GET /concepts/weakest` endpoint (returns top 3 weakest concepts).
- Added `WeakConceptsWidget` to Dashboard (shows mastery % and "Train" button).
- "Train" button launches a 5-question targeted quiz session.
- Verified build and lint checks pass.

### Sprint 1 QA Pass – Summary
**Date:** 2026-02-09

**Checked:**
- ✅ Loading state: Skeleton properly animates with matching header layout
- ✅ Empty state: Widget hides gracefully when no weak concepts exist
- ✅ Error state: Now shows user-friendly error message instead of returning null
- ✅ Alignment and spacing: Fixed skeleton header to match actual header layout
- ✅ Progress bar display: Conditional coloring (warning vs primary) based on mastery %

**Dashboard Integration:**
- ✅ Widget placement correct (between Daily Sprint and Stats Grid)
- ✅ Mobile responsive (grid-cols-1 → md:grid-cols-3)
- ✅ No layout breaking (tested with long concept names via truncate)

**UI Improvements Made:**
1. Skeleton header now matches actual header structure (icon container + text)
2. Added `WeakConceptsError` component for graceful error handling
3. All states wrapped with `slideUpItem` animation for consistency

**Status:** Ready for Sprint 1 completion

## Sprint 2 – Document Progress & Milestones
- Implemented `GET /documents/{id}/progress` endpoint.
- Implemented `GET /documents/progress/summary` endpoint.
- Added `DocumentProgressResponse` and summary response schemas.
- Added backend tests in `backend/tests/test_document_progress.py`.

### Sprint 2 QA Pass – Notes
**Date:** 2026-02-12

**Checked:**
- ✅ Mastery normalization now handles both legacy ratio scale (`0..1`) and stored percent scale (`0..100`).
- ✅ `mastery_percent` is clamped/validated to `0..100` and guarded against invalid numeric values.
- ✅ Milestone thresholds remain deterministic at `25/50/75/100`.
- ✅ Missing/non-owned document id returns `404` on per-document progress endpoint.
- ✅ Documents with concepts but no mastery records return sensible values (`mastery=0`, practiced `0`, weak `0`).

**Backend improvements applied:**
1. Replaced summary endpoint N+1 fetch pattern with batched queries (`documents`, `concepts`, `user_concept_mastery`) and in-memory grouping.
2. Centralized progress calculation logic for consistency across single-document and summary endpoints.
3. Updated weak-concept logic to avoid counting unpracticed concepts as weak.
4. Added schema validation for `mastery_percent` (`ge=0`, `le=100`).

### Sprint 2 UI QA Pass – Notes
**Date:** 2026-02-12

**Checked:**
- ✅ Empty states: Added guidance message when mastery is 0% ("Start your first sprint to begin tracking mastery")
- ✅ Empty states: Added "Retry Loading" button to ConceptList empty state
- ✅ Consistency: Percent formatting uses `Math.round()` consistently across DocumentDashboard and DocumentCard
- ✅ Consistency: Milestone badges use consistent styling (25/50/75/100 with 🏆/🎯 icons)
- ✅ Visual polish: Improved mini progress bar spacing in DocumentCard (`mb-5 space-y-2.5`)
- ✅ Visual polish: Added subtle helper text for 0% mastery in DocumentCard
- ✅ CTA: "Continue Learning" button shows tooltip explaining why "Train Weak Concepts" isn't available

**UI improvements applied:**
1. `DocumentDashboard.tsx`: Added 0% mastery guidance message; Added Tooltip for CTA when no weak concepts exist
2. `ConceptList.tsx`: Added retry button to empty state; Updated copy to "No concepts yet"
3. `DocumentCard.tsx`: Milestone now uses Badge component with consistent styling; Added helper text for 0% mastery; Improved spacing around progress section

## Sprint 3 – Document Summary Component (sync + robustness)
- Added concept-sync hash support for document summaries.
- Added summary regeneration guard based on concept hash.
- Added `GET /documents/{id}/summary` endpoint behavior checks and robustness fixes.

### Sprint 3 Backend QA Pass – Notes
**Date:** 2026-02-12

**Checked:**
- ✅ Added `documents.summary_concepts_hash` migration and model field.
- ✅ Summary generation stores `summary_concepts_hash` and reuses summary when hash matches.
- ✅ Summary endpoint returns `404` for missing/non-owned document and `409` when concepts are not ready.
- ✅ Added strict JSON-key validation for summary payload with parse retry.
- ✅ Added deterministic fallback summary when LLM output is invalid after retry.
- ✅ Bullet-like fields are clamped to max 12 words.

**Backend improvements applied:**
1. Implemented concept hash computation with stable ordering.
2. Added retry prompt enforcing JSON-only response.
3. Added fallback summary path to prevent empty/error summary states.
4. Added summary endpoint tests for `404`, `409`, hash-match reuse, and hash-mismatch regeneration.

### Sprint 3 UI QA Pass – Notes
**Date:** 2026-02-12

**Checked:**
- ✅ Loading state: Skeleton UI with proper structure (header + content lines)
- ✅ 409 concepts not ready: Shows "Summary coming soon" with clear messaging
- ✅ 404 doc missing: Shows "Document not found" with helpful context
- ✅ Empty/malformed summary: Detects empty arrays and shows fallback with refresh option
- ✅ Collapsed default: Component defaults to collapsed state ✓
- ✅ Accessibility: Added proper ARIA attributes (aria-expanded, aria-controls)

**Readability & Premium Feel:**
- ✅ Improved spacing: `space-y-4` and `gap-6` for better visual rhythm
- ✅ Bullet formatting: Larger bullets (w-1.5 h-1.5) with better alignment
- ✅ Badge styling: Added padding (`py-1 px-2.5`) for key concept badges
- ✅ Typography: Consistent leading-relaxed for better readability
- ✅ Button converted to `<button>` element for proper accessibility

**Regenerate/Refresh:**
- ✅ Backend auto-regenerates on GET when concept hash mismatches (no explicit POST needed)
- ✅ Added refresh button in footer for manual re-fetch
- ✅ Loading state with spin animation on refresh button
- ✅ Refresh also available in error states for retry

**UI improvements applied:**
1. `DocumentSummary.tsx`: 
   - Added specific 404 error handling with FileX icon
   - Enhanced 409 state with better messaging and icon
   - Added empty/malformed summary detection (all fields empty)
   - Improved spacing throughout (gap-6, space-y-4, p-5)
   - Added ARIA attributes (aria-expanded, aria-controls)
   - Added footer with AI disclaimer and refresh button
   - Conditional rendering for each section based on data availability
   - Removed unused `ApiError` import (error is string from SWR)
2. `useDocumentSummary.ts`: Already exposes `mutate` for refresh functionality

**Bugfix:** DocumentSummary component was not mounted on DocumentDashboard; now calls summary endpoint.
- **Problem:** `DocumentSummary` component existed but was never imported or used in `DocumentDashboard.tsx`
- **Solution:** Added import and mounted `<DocumentSummary documentId={documentId} />` unconditionally between Stats Grid and Concept List
- **Files changed:** `frontend/src/components/dashboard/DocumentDashboard.tsx`

## Sprint 4 – Smart Review (Spaced Reinforcement v1)
- Implemented `GET /review/today` endpoint returning due concepts (mastery < 75% or stale > 2 days).
- Added `get_due_concepts` service logic with consolidated mastery/staleness filtering.
- Created `ReviewTodayWidget` on Dashboard to surface due concepts.
- Implemented "Review Now" CTA that launches a focused quiz session.
- Added backend tests for review endpoint logic.
- Verified frontend build and component integration.

### Sprint 4 QA Pass – Notes
**Date:** 2026-02-13

**Checked:**
- ✅ Backend: `GET /review/today` correctly returns due concepts based on mastery and staleness.
- ✅ Backend: Service handles empty states and gracefully returns empty lists.
- ✅ Frontend: Widget displays correct count and concept previews.
- ✅ Frontend: "Review Now" button creates a session with the correct target concepts.
- ✅ Frontend: Empty state ("All caught up") is handled visually.
- ✅ Tests: Backend unit tests pass for valid and empty data scenarios.

### Sprint 4 QA Pass – Review Today (Backend correctness + performance)
**Date:** 2026-02-13

**Checked:**
- ✅ `last_practiced_at`/`last_tested_at` compatibility: due-concepts query now gracefully falls back across column variants.
- ✅ Ordering: returns lowest `mastery_score` first, then oldest practice timestamp when available (null timestamps sorted last).
- ✅ Response contract: `/review/today` returns `mastery_score`, `mastery_percent`, and `rules` metadata.
- ✅ Auth/ownership: only rows filtered by authenticated `user_id` are considered from `user_concept_mastery`.
- ✅ Query efficiency: two batched queries (mastery + concepts), no N+1 pattern.
- ✅ Limit enforcement: API and service now enforce max `20`.
- ✅ Empty state: contract preserved (`count=0`, `due_concepts=[]`).

**Minimal safe fixes applied:**
1. `backend/app/services/concepts.py`: added robust practice-date column fallback and deterministic secondary ordering with nulls last.
2. `backend/app/services/concepts.py`: added service-side hard cap for `limit` at `20`.
3. `backend/app/api/routes/review.py`: tightened query param validation from `le=50` to `le=20`.
4. `backend/tests/test_review.py`: added tests for endpoint limit validation and service fallback/ordering behavior.

### Sprint 4 UI QA Pass – ReviewTodayWidget
**Date:** 2026-02-13

**Checked:**
- ✅ **Loading state:** Skeleton properly animates with matching header + content structure
- ✅ **Error state:** New `ReviewTodayError` component shows user-friendly message with Retry button (was returning null)
- ✅ **Count > 0 state:** Displays count badge with concept preview chips (+N more indicator)
- ✅ **All caught up state:** Shows success message with "Check back tomorrow" guidance

**CTA Behavior:**
- ✅ Uses up to 5 due concept ids (`slice(0, 5)`)
- ✅ `num_questions=5` (fixed from incorrect `Math.min(conceptIds.length * 2, 5)`)
- ✅ Redirects to `/session?session_id={id}` route
- ✅ Filters concepts to primary document (handles multi-doc constraint)

**Premium Polish:**
- ✅ **Spacing:** Removed hardcoded `mb-8`, now relies on parent `space-y-8` (matches DailySprintCard rhythm)
- ✅ **Copy:** "Check back tomorrow" added to caught-up state for clear guidance
- ✅ **Badges:** Count now renders as styled badge (bg-brand/10 text-brand) instead of plain text
- ✅ **Visual hierarchy:** Decorative blur gradient, proper text colors (text-secondary for labels)
- ✅ **No visual competition:** Secondary styling (clock icon, subdued colors) vs Daily Sprint's gradient + mascot

**UI Improvements Applied:**
1. `ReviewTodayWidget.tsx`:
   - Fixed `num_questions` to always be 5 as per spec
   - Added `ReviewTodayError` component with AlertCircle icon and Retry button
   - Updated "All caught up" copy to include "Check back tomorrow"
   - Converted count display to badge style (rounded-full bg)
   - Removed `mb-8` class to let parent container control spacing
   - Added AlertCircle and RefreshCw icon imports

**Files changed:**
- `frontend/src/components/dashboard/ReviewTodayWidget.tsx`

## Sprint 5 – Daily Usage Limits (atomic + clean)
- Verified daily usage limits for `POST /sprint/start` and `POST /quiz/sessions/`.
- Hardened quota consume path to be atomic under race with compare-and-swap retries.
- Kept quota increment after successful session creation, and added cleanup if quota consume fails after create.
- Added structured 429 payload contract with stable fields: `error`, `type`, `limit`, `message`.
- Refactored usage limit tests to remove brittle `sys.modules` patching and use direct route/service patching.

### Sprint 5 QA Pass – Notes
**Date:** 2026-02-13

**Checked:**
- ✅ Atomicity: quota consumption now retries on contention and avoids lost updates.
- ✅ Error shape: 429 detail now includes `{ error: "daily_limit_reached", type, limit, message }`.
- ✅ Placement: quota is consumed only after successful sprint/quiz creation.
- ✅ Retry safety: `/sprint/start` returns existing active session without re-consuming quota.
- ✅ Tests: usage-limit tests now use clean dependency patching (no `sys.modules` mutation).

### Sprint 5 UI QA – Daily Limit States
**Date:** 2026-02-13

**Messaging Consistency:**
- ✅ Unified to "Daily limit reached" + "Come back tomorrow" pattern across both components
- ✅ Updated `errorMessages.ts` 429 message to match premium tone (was "Whoa, slow down!")
- ✅ Toast messages now consistent: "Daily limit reached. Come back tomorrow."

**Disabled State Polish:**
- ✅ DailySprintCard: Disabled button uses muted styling (`bg-muted text-muted-foreground`) with 60% opacity
- ✅ ReviewTodayWidget: Disabled button uses consistent muted styling with Clock icon
- ✅ Both CTAs show `cursor-not-allowed` for clear affordance
- ✅ Outline variant used for disabled state to reduce visual weight

**Limit Info Display:**
- ℹ️ Sprint: 1/1 used today – **deferred** (requires backend to expose usage in status response)
- ℹ️ Quizzes: 5/5 used today – **deferred** (requires backend to expose usage in review endpoint)
- Note: Paywall UI intentionally not added per requirements

**Files changed:**
- `frontend/src/components/dashboard/DailySprintCard.tsx`
- `frontend/src/components/dashboard/ReviewTodayWidget.tsx`
- `frontend/src/lib/errorMessages.ts`

Sprint 5 Hook-Order Hotfix – Fixed conditional hook in DailySprintCard causing React error #310 when plan_type changes or limits trigger UI state transitions.

## Sprint 5.5 – Pro bypass for usage limits
- Implemented `is_pro` helper and updated usage service to bypass limits for Pro users.
- Added comprehensive tests verifying Pro users can exceed daily sprint/quiz limits without error.
- Verified Free users are still subject to limits.

## [Sprint 6] XP Redemption Implementation
- **Goal**: Allow users to exchange 100 XP for 1 extra quiz credit.
- **Backend**:
  - Added `extra_quizzes` column to `user_daily_usage`.
  - Implemented `POST /xp/redeem` handling atomic deductions and credit grants.
  - Updated `SprintStatusResponse` to include calculated `quiz_credits`.
- **Frontend**:
  - Updated `StatsHUD` to display available quiz credits.
  - Added redemption CTA within the XP tooltip.
  - Integrated with `useDailySprint` hook for redemption actions.
- **Verification**:
  - Added `backend/tests/test_xp_redemption.py` covering success and failure scenarios.
  - Manual UI verification of credit display and redemption flow.
