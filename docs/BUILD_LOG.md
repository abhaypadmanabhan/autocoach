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
