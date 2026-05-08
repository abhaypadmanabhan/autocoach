# Document Detail → Adaptive Session Quiz Entry

**Spec date:** 2026-05-07
**Status:** Draft, awaiting approval (no code yet)
**Related:** PR4 (latency-split adaptive loop), PR3 (sprint orphan cleanup)

## Goal

Wire the document detail page to the adaptive session flow with a single, unmistakable "Start Quiz" action. Strip every dead button and stat card from the old daily-sprint era. Result: doing-first usability — open a doc, see what you've mastered, hit one button, learn.

---

## A. Audit of current document detail page

**Route:** Lives under `/dashboard?docId=<id>` (search-param routing, not its own segment). The dashboard page at `frontend/src/app/dashboard/page.tsx:91-99` reads `searchParams.get("docId")` and conditionally mounts `<DocumentDashboard documentId={docId} />` instead of the dashboard home.

**Component:** `frontend/src/components/dashboard/DocumentDashboard.tsx` (312 lines).

**Buttons / Links rendered (current state on main):**

| # | Element | Location | Behavior | Verdict |
|---|---------|----------|----------|---------|
| 1 | "Delete" button | `DocumentDashboard.tsx:169-177` | Opens confirm modal → `useDeleteDocument` → toast → `router.push("/dashboard")` | **Functional** — keep, demote to icon-only secondary |
| 2 | "Refresh Data" button | `DocumentDashboard.tsx:179-186` | `window.location.reload()` — full page reload | **Functional but crude** — kill it. SWR + the auto-refresh effect at lines 69-89 already handle this |
| 3 | "Train Weak Concepts" button | `DocumentDashboard.tsx:188-194` | `<Link href={`/dashboard?docId=${id}`}>` — links to current URL | **DEAD LOOP** — points back to itself, no action. PR3 left this hanging when `/sprint/start` was deleted. Remove. |
| 4 | "Continue Learning" button | `DocumentDashboard.tsx:195-211` | Same dead loop as #3, behind a tooltip | **DEAD LOOP** — remove |
| 5 | Per-concept "Quiz Concept" button | `ConceptList.tsx:122-128`, every row | Same dead loop href | **DEAD LOOP** — remove the entire action column |
| 6 | "Retry Loading" inside empty-concepts state | `ConceptList.tsx:39-45` | `window.location.reload()` | **Crude** — replaced with proper empty state in new design |
| 7 | "Back to Dashboard" link inside error state | `DocumentDashboard.tsx:103` | navigates to `/dashboard` | **Functional** — keep |

**Stats grid (`DocumentDashboard.tsx:215-273`):** three cards (Overall Mastery, Concepts Mastered, Focus Areas) — visual noise. Replace with one inline line.

**Other clutter to drop:**
- "Document Dashboard" outline badge (`DocumentDashboard.tsx:140-142`) — redundant given the page title
- "Processing" badge logic — fold into empty/disabled state of primary CTA
- Milestone badge — fine to keep, but small + adjacent to mastery line, not in header
- Mini concept dots visualization (lines 244-255) — remove, redundant with concept list bars
- `MascotStage mode="dashboard"` — keep as a single small flair element near header

---

## B. New design — minimalist, doing-first

**Aesthetic direction:** Editorial-minimalist, OLED dark, asymmetric. One element dominates: the Start Quiz button. Everything else recedes. Generous negative space above the CTA, dense legible content list below.

**Tone:** confident, unhurried. The page is a reading desk with a single big "GO" button.

**Component tree (new `DocumentDashboard.tsx`):**

```
<DocumentDashboard documentId={...}>
  ├── <PageContainer size="xl">
  │   ├── <Header>
  │   │   ├── eyebrow: "DOCUMENT"  (uppercase, tracked, --text-muted)
  │   │   ├── <h1> document.ai_title ?? document.filename  (font-serif, 4xl-6xl)
  │   │   ├── <MasteryLine>
  │   │   │   "X of Y concepts mastered · Z% overall"
  │   │   │   plus optional <MilestoneBadge> if milestone
  │   │   └── <DeleteIconButton>  (top-right, icon only, ghost trash icon)
  │   ├── <PrimaryCTA>
  │   │   ├── massive button, full row width on mobile, ~520px desktop
  │   │   ├── label resolves per state (see C + D)
  │   │   ├── icon: PlayCircle or RefreshCw (mastered case)
  │   │   ├── coral→gold gradient (matches dashboard "Study New" CTA)
  │   │   └── meta line below: "10 questions · adaptive difficulty"
  │   └── <ConceptListReadOnly>
  │       ├── header: "Concepts" + count chip
  │       └── rows: concept_name (+ CORE badge), importance stars, mastery bar
  │       │       NO action column / NO buttons
  └── <DeleteConfirmModal>   (unchanged behavior, restyled)
```

**Layout cues:**
- Header right-aligned delete; everything else left-aligned with generous left padding
- 12rem vertical breathing room above the CTA; 4rem below
- CTA centered horizontally on mobile, anchored left on desktop ≥1024px
- Concept rows keep current 3-column structure (name | importance stars | mastery bar) minus the action column

**Typography:** reuse existing project stack. `font-serif` (Rubik display per CLAUDE.md memory) for h1; default sans for everything else. No new fonts.

**Color:** existing CSS vars only — `--surface-dark` background, `--surface-card` for concept list shell, `--text-primary/secondary/muted`, `--pop-coral` and `--pop-gold` for CTA gradient (mirrors dashboard root). No purple-on-white. Mastered state CTA shifts to `--semantic-success` tint to communicate completion without changing the layout.

**Motion:** single staggered entrance on mount via `staggerContainer` + `slideUpItem` from `frontend/src/lib/motions.ts` (already used in dashboard root). Hover on CTA: `whileHover={{ scale: 1.01 }}`, subtle. No micro-animations on the concept rows beyond the existing `whileInView` opacity in `ConceptList.tsx`.

**Differentiator:** the absence of competing buttons. Where the old page had 4 CTAs of equal weight (Delete, Refresh, Train Weak, Continue), the new page has **one**, and it is unmissable.

---

## C. Click flow

1. User lands on `/dashboard?docId=<id>`.
2. New `DocumentDashboard` mounts, fetches document + concepts + progress (existing hooks: `useDocument`, `useDocumentConcepts`, `useDocumentProgress`).
3. User clicks Start Quiz.
4. Frontend calls existing hook `useCreateSession` from `frontend/src/hooks/useQuiz.ts:69-102` with payload:
   ```ts
   {
     document_id: document.id,
     num_questions: 10,
     difficulty: "medium",
     question_types: ["text_mcq", "text_tf", "text_free"],
   }
   ```
   No `focus_concept_ids` — adaptive loop selects per concept-mastery via PR2 logic.
5. Backend `POST /quiz/sessions/` (`backend/app/api/routes/sessions.py:108`) creates session row, kicks off Q1 generation async per PR4 (status `pending` → `ready`). Returns `session_id` immediately.
6. Frontend `router.push(\`/session?session_id=\${response.session_id}\`)`.
7. Existing `/session` page handles the rest: `useCurrentQuestion` polls/loads Q1, `useNextQuestion.pollUntilReady` handles each subsequent question, completion redirects to `/results?session_id=…`.

**No backend changes needed.** All wiring is to endpoints that already exist.

---

## D. Edge cases

| State | Detection | UI |
|-------|-----------|----|
| Document still processing | `document.status === "processing"` | CTA: disabled, label "Preparing your quiz…", small spinner. Concept list shows skeleton rows. |
| Document failed | `document.status === "failed"` | Replace CTA with error card: "We couldn't process this document." Show `document.error_message` if present. Action: link to `/upload` saying "Try a new upload". No Start button. |
| Zero concepts after ready | `document.status === "ready" && concepts.length === 0` | Replace CTA with empty card: "No concepts could be extracted from this document." Action: link to `/upload`. Concept list section hidden. |
| All concepts mastered | `concepts.length > 0 && concepts.every(c => (c.mastery_score ?? 0) >= 80)` | CTA label flips to "Review Mastered Concepts", icon → `RefreshCw`, gradient → success-tinted. Same click handler — backend will pick review-flavored questions via existing adaptive logic. Below CTA: "Mastered all X concepts. Refresh your memory." |
| `useCreateSession` 4xx/5xx | `useCreateSession.error` | Inline toast via existing `useToast` ("Couldn't start quiz. Try again."). Button re-enables. No redirect. |
| `useCreateSession` 429 (over usage) | error.status === 429 | Toast: "Daily quiz limit reached." Same as above otherwise. |
| Network offline | fetch throws | Same toast, generic message. |
| Auth expired | hook throws 401 → `apiFetch` redirects to `/login` (existing behavior in `frontend/src/lib/api.ts:93-96`) | No work needed |

---

## E. Files touched

**Modified:**
- `frontend/src/components/dashboard/DocumentDashboard.tsx` — full rewrite per Section B. Drop Train Weak / Continue Learning / Refresh Data. Drop 3-card stats grid → 1-line mastery summary. Demote Delete to icon button. Add primary CTA + click handler using `useCreateSession` + `useRouter.push("/session?…")`.
- `frontend/src/components/dashboard/ConceptList.tsx` — remove the action column (lines 64 header cell, 122-128 row cell). Restyle empty state copy. Adjust grid to 3 columns (5 / 2 / 5 split for name / importance / mastery).

**Added:**
- *(none)* — no new components or hooks. Reuse existing `useCreateSession`, `useDocument`, `useDocumentConcepts`, `useDocumentProgress`, `useDeleteDocument`, `useToast`, `useRouter`, `MascotStage`, `Button`, `PageContainer`, `staggerContainer`, `slideUpItem`.

**Deleted:**
- *(none at file level)* — `WeakConceptsWidget.tsx` is still referenced by the dashboard root page (`frontend/src/app/dashboard/page.tsx:196`); leave alone for this PR. Cleanup of widget-level dead UI on dashboard root is out of scope (separate PR).

---

## F. Test plan

**Static:**
- `npx tsc --noEmit` (frontend) passes.
- `npm run lint` (frontend) passes.
- No remaining `git grep` hits in `frontend/src/` for `Train Weak`, `Train weak`, `Quiz per topic`, `Continue Learning` (modulo /results page if used there — verify).

**Manual on dev (`npm run dev` + uvicorn local):**
1. Upload a fresh document. Land on dashboard → click document → confirm "Preparing your quiz…" disabled CTA while `status === "processing"`.
2. Wait for processing → CTA becomes "Start Quiz" with concept list populated.
3. Click Start Quiz. Network panel: `POST /quiz/sessions/` 200 with `session_id`. URL changes to `/session?session_id=<id>`. Q1 loads.
4. Complete a quiz to mastery (or directly seed `concepts.mastery_score = 100`). Return to detail page → CTA reads "Review Mastered Concepts" with success tint.
5. Trigger error: stop backend, click Start Quiz → toast "Couldn't start quiz" appears, button re-enables, no redirect.
6. Trigger 429: hit daily limit, click Start Quiz → "Daily quiz limit reached" toast.
7. Visit `/dashboard?docId=<id-of-failed-doc>` → error card with "Try a new upload" link, no Start button.
8. Visit `/dashboard?docId=<id-of-zero-concept-doc>` → empty card, no concept list, no Start button.
9. Delete from icon button → confirm modal → confirm → toast + redirect to `/dashboard`. Existing behavior preserved.

**End-to-end on prod (post-merge):**
- Smoke same flows on `https://autocoach-rho.vercel.app/` with one ready doc and one failed doc.
- `/health` 200. `alembic current = 02968ade0f8e` (no new migration in this PR).
- Console: zero CSP errors, zero TypeError, zero 4xx/5xx for documented happy path.

**Regression watch:**
- Dashboard root page (`/dashboard`) untouched — should render identically.
- `/session` page untouched — should pick up `session_id` from query string and render Q1 normally.
- `useCreateSession` already exercised by this flow; no other call sites change.

---

## G. Open questions / approval gates

1. **Default `num_questions`.** Spec uses 10. Confirm — earlier sprints used 10; PR2 adaptive loop also defaults to 10.
2. **Default `difficulty`.** Spec uses `"medium"`. Confirm — PR2 may have a different default; verify before code.
3. **`question_types` enum names.** Using new PR2 names `text_mcq`/`text_tf`/`text_free`. Confirm these are what `QuestionType` resolves to in `frontend/src/lib/types.ts` (older code referenced `mcq`/`true_false`/`free_text`).
4. **Mastery threshold for "all mastered" state.** Using `>= 80`. Confirm that's the project's mastery cutoff (matches existing `masteredConcepts` filter at `DocumentDashboard.tsx:112`).
5. **MascotStage placement.** Keep next to title, or drop entirely for stricter minimalism? Spec keeps it. Flag if you want it gone.

Resolve 1-5 before implementation. After approval I'll write code in one PR matching this spec exactly.
