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
