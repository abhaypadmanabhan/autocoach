# AutoCoach iOS — Design PRD (Milestone 3 → v1 App Store)

**Status:** draft for build · **Date:** 2026-07-27 · **Branch base:** `dev` (`937c6e0`)
**Owner:** orchestrator (Claude Opus 5) · **Herdr run:** `20260727-2005-49`
**Inputs:** `~/.herd/runs/20260727-2005-49/tasks/t01.result.md` (competitive research, cc1),
`t02.result.md` (codebase audit, opencode), Mobbin iOS pattern search, `ios/docs/architecture-research.md`.

**Hard constraint: the backend is frozen.** Everything specified as in-scope below is a
**client-only** change against the existing API. Anything needing a server change is in §9 and is
explicitly out of scope.

---

## 1. Where the app actually is today

Milestones 1 and 2 are merged (PR #62, #69). 2,159 lines of Swift, 15 files.

**Works end-to-end:** email+password sign-in → flat document list → start a standard 5-question
session → MCQ / true-false / free-text with voice dictation → async verdict polling → results.

**Consumes 6 of 23 backend endpoints (26%).** The unused 17 are not future features — they are
finished server capability the app is throwing away:

| Unused endpoint | What the user loses |
|---|---|
| `GET /review/today` | The entire spaced-repetition product. Backend computes due concepts; nothing shows them. |
| `GET /documents/{id}/concepts` | Per-concept mastery — the thing that makes this not-a-quiz-app. |
| `GET /documents/progress/summary`, `/{id}/progress` | All progress UI. Mastery %, milestones. |
| `POST /documents/register` + Storage | **A new user cannot add a document. The app is unusable on a fresh account.** |
| `GET /onboarding`, `POST /onboarding` | No personalization; the goal/level/cadence data is never captured. |
| `POST /xp/redeem` | XP accrues (`xp_awarded` comes back on every answer) and can never be spent. |
| `GET /quiz/sessions/{id}/current` | Kill the app mid-quiz and the session is stranded. |

There is also **no sign-up screen** — accounts can only be created on the web. Combined with no
upload, the native app currently cannot take a user from install to first quiz.

**Design system:** `ACX.swift` has the core Padzy OS primitives (colors, hard shadow, kicker,
hairline, status pill, button styles, ground). **Custom fonts are not bundled** — `glob ios/**/*.{ttf,otf}`
returns nothing, `Info.plist` has no `UIAppFonts`, and `ACXFont` falls back to system faces (issue #67).

---

## 2. Market position — what we are actually competing against

Full profiles in `t01.result.md` §1 (12 apps). The three findings that shape this PRD:

1. **Quizlet's 2026 repricing moved Learn mode, practice tests and AI behind a ~$2.99/mo tier**,
   and there is an active migration of students away from it. Knowt is capturing them with
   *import-as-onboarding* — the hero first-run action removes the empty state entirely.
2. **Ingest breadth is the visible axis of competition**, not question quality. Every serious
   competitor accepts ≥4 source types (file, camera/scan, lecture audio, link). AutoCoach accepts
   two file types through one path — and on iOS, through *no* path.
3. **AutoCoach's real moat is already built and invisible.** Per-concept mastery
   (`user_concept_mastery`) and a due-review queue are exactly what Brainscape and Anki users pay
   for, and the iOS app renders none of it. *Surfacing existing backend data outranks building new
   features.*

### Stealable mechanics, mapped to what we already have

| Competitor mechanic | AutoCoach equivalent that already exists | Cost |
|---|---|---|
| Anki/Brainscape: **due count is the home screen** | `GET /review/today` returns `count` + `due_concepts[]` | S |
| Brainscape: **mastery % per deck** | `mastery_percent` on `GET /documents/{id}/progress` | M |
| Gizmo/Duolingo: **hearts as the session gate** | the 5/day quota + `POST /xp/redeem` as the recovery action | S — pure presentation |
| Duolingo: **streak + freeze** | local-only (no per-day activity endpoint — see §9) | M |
| Duolingo/Quizlet: **streak widget** (~60% daily-open commitment lift) | App Group cache + `BGAppRefreshTask` | M |
| Knowt/Turbo: **importer as onboarding** | Share Extension → Storage → `/documents/register` | M |
| Gauth/Gizmo: **camera-first ingest** | VisionKit → PDF → same register path | M |
| NotebookLM: **explicit generation controls** (count / difficulty) | `POST /quiz/sessions/` already takes `num_questions`, `difficulty`, `question_types`, `focus_concept_ids` — **all hardcoded in the iOS client today** | S |

That last row is the cheapest win in the document: the session-config API is fully built and the
native client sends the same fixed payload every time.

---

## 2.5 Design authority — read before writing any UI

Two design documents govern this app and they **conflict**. This section is the resolution.
Follow it literally; do not re-derive it.

1. **Padzy OS / "Quiet Brutalism"** — defined in the repo's `CLAUDE.md`. Mandates numbered mono
   kickers (`01 / TODAY`), Space Mono for all data, zero radii, hard offset shadow on the primary
   CTA only, status as mono text + mark.
2. **The house UI-UX rules** — `/Users/abhayp/Documents/Obsidian Vault/UI-UX`, especially
   `AI Design Tells.md`. Bans mono kickers, mono as a UI font, coloured status dots, and 11–13px type.

**Padzy OS wins on identity.** It is the documented, shipped design system for this product across
web and iOS, and the global rules state project instructions override on conflict. Mono kickers,
mono numerals, zero radii and the hard shadow stay exactly as specified.

**The UI-UX rules win on craft**, because those items are legibility and signal quality, not brand:

| Rule adopted | What changed | Where |
|---|---|---|
| Type floors — "nothing under 15px, mono never under 13.5px" | `ACXFont` **clamps at the source**: mono ≥ 13pt, body ≥ 15pt, display ≥ 20pt. Adapted from web px to iOS points (13pt = system `.footnote`) rather than copied blindly. A lane physically cannot ship an 11pt label. | `Design/ACX.swift` |
| "Form carries the state, colour carries the urgency" | The coloured status dot is gone. `StatusMark` gives each state a distinguishable **shape** — hollow ring (pending), level bars (processing), hairline check (ready), dashed ring (unknown) — and spends colour only on `failed`, the one state that needs a human. | `Design/ACX.swift` |
| Same, applied to metadata | Difficulty and question-type labels were wearing status dots. They are descriptors, not states, so they use the new `TagPill` and leave the mark vocabulary meaning something. | `Design/ACX.swift` |
| Six-states discipline; permissions deferred to the moment of need; 44pt targets; thumb-zone primary actions | Already required throughout §5 — every screen must design loading / empty / error / quota / offline. | all lanes |

**Consequences for every lane:**
- Never write `Circle().fill(someColor)` to indicate state. Use `StatusMark`.
- Never pass a font size below the floors — and do not bypass `ACXFont` to get around the clamp.
- The **only** coloured mark permitted in a view is a genuine failure state. Everything else is ink.
- `.fontWeight()` does **not** drive the weight axis on our variable custom fonts. Use the explicit
  helpers (`ACXFont.monoBold`, `.bodySemibold`, `.displayMedium`) instead.

### Build gotcha every lane will hit

`ios/AutoCoach/Info.plist` is **generated by xcodegen and gitignored**, and `ios/Config.xcconfig`
is gitignored too. A fresh worktree therefore fails to build until you run:

```bash
cp /Users/abhayp/Downloads/Projects/autocoach/ios/Config.xcconfig ios/Config.xcconfig
cd ios && xcodegen generate
```

Do this first, before your first `xcodebuild`, or you will chase a phantom
"Build input file cannot be found: .../Info.plist".

---

## 3. Product principles (iOS)

1. **Surface what the backend already knows.** Every screen must earn its place by rendering data
   we already pay to compute. No new invented state.
2. **The due queue is the product.** Home is "what should I study right now", not "here are your files".
3. **Constraints are framed as game state, never as errors.** The 5/day quota is credits you spend
   and can earn back — never a red 429 alert. (Imprint's "NEXT QUIZ IN 13h 52m" over a bare error.)
4. **Quiet Brutalism is not negotiable.** Zero radii, hard offset shadow reserved for the primary CTA
   and the active quiz card, one accent per view, mono for all data. Any Mobbin reference below is
   cited for *structure and information hierarchy only* — never for its rounding, shadows, or gradients.
5. **Native surfaces over spinners.** The latency-split pipeline (fast answer write → background
   generation → long-poll) is unusually well suited to Live Activities and background refresh. A
   web-parity port shows a spinner where iOS gives us a system surface for free.
6. **Nothing blocks on the backend.** If a feature needs a server change, it is in §9, not in a sprint.

---

## 4. Information architecture

Today: `RootView` switches straight to `DashboardView`. There is no tab bar.

Target — three tabs, each its own `NavigationStack`, quiz as a `fullScreenCover` (modal focus task
with explicit exit, per the M1 architecture decision):

```
AppRoot
└─ RootView  (switch: loading / signedOut / signedIn+needsOnboarding / signedIn)
   ├─ AuthFlow          NavigationStack
   │    ├─ WelcomeView              [NEW]  value prop → Sign in with Apple / email
   │    ├─ LoginView                [HAS]
   │    ├─ SignupView               [NEW]
   │    └─ ForgotPasswordView       [NEW]
   ├─ OnboardingFlow    [NEW]  4 steps, first run only → POST /onboarding
   └─ MainTabView       [NEW]
      ├─ 01 TODAY       NavigationStack           [NEW]  ← the home screen
      │    └─ TodayView            due count, credits, streak, continue-session, jump to review
      ├─ 02 LIBRARY     NavigationStack
      │    ├─ LibraryView          [HAS, rework]  docs + mastery + activation checklist
      │    ├─ DocumentDetailView   [NEW]          concepts, mastery, focused quiz start
      │    ├─ UploadFlow (sheet)   [NEW]          Files / camera scan → Storage → register → poll
      │    └─ SessionConfigSheet   [NEW]          count / difficulty / types / focus concepts
      ├─ 03 PROFILE     NavigationStack           [NEW]
      │    ├─ ProfileView          XP, credits, mastery summary, streak
      │    ├─ SettingsView         [NEW]          account, reminders, password reset, sign out
      │    └─ Legal (Terms/Privacy)[NEW]
      └─ fullScreenCover: QuizSessionView → ResultsView   [HAS, extend]
```

**Why TODAY and not the library as the first tab:** the library is a file manager; the due queue is
the reason to open the app. Anki, Brainscape and RemNote all lead with the queue. Our
`GET /review/today` already returns exactly the payload this screen needs, and review-mode sessions
are **quota-free** — so the first tab is also the cheapest thing a user can do.

---

## 5. Screen specifications

Every screen below lists: purpose → entry → endpoints → states → layout → Mobbin reference →
acceptance. States are mandatory: **loading / empty / error / quota-exhausted / offline** must each
have a designed answer, not a spinner.

---

### 5.1 WelcomeView `[NEW]` · P0

**Purpose:** first launch. Establish the value prop before asking for anything.
**Entry:** cold launch, signed out. **Endpoints:** none.

**Layout (Padzy OS):**
- `00 / AUTOCOACH` kicker, hairline.
- Display line: "Turn your notes into a tutor that knows what you forgot."
- Three mono bullets, each with a 2px accent left tick: `YOUR DOCUMENTS` / `ADAPTIVE QUESTIONS` /
  `SPACED REVIEW`.
- Primary CTA (hard shadow): **Continue with Apple**. Secondary ghost: **Continue with email**.
  Footer mono link: `ALREADY HAVE AN ACCOUNT? → SIGN IN`.
- Below the fold, one line of mono legal: `BY CONTINUING YOU AGREE TO OUR TERMS / PRIVACY`.

**Mobbin reference:** [Brilliant — account creation with social row then "Continue with email"](https://mobbin.com/flows/7ffbd4f0-78d1-49be-bf0d-9c90cac00e8c)
(screen 12 of the flow). Take the *hierarchy* — social buttons above an OR rule above email, with
"Existing user? Log in" as a de-emphasised footer — and drop its pill shapes entirely.

**Acceptance:** signed-out cold launch shows Welcome, not Login. Both CTAs route correctly.
Sign in with Apple is functional (Supabase provider config only, no backend code).

---

### 5.2 SignupView `[NEW]` · P0 — **currently blocks all new native users**

**Purpose:** create an account without leaving the app.
**Entry:** Welcome → Continue with email. **Endpoints:** Supabase Auth `signUp(email:password:)`.

**States:**
- inline validation — email format, password ≥ 8 chars, shown on blur not on keystroke;
- **email-confirmation pending** — if the Supabase project requires confirmation, a dedicated
  "Check your inbox" state with the address echoed in mono and a **Resend** ghost button. This is the
  state most native ports forget and it strands the user permanently;
- duplicate-account error → offer "Sign in instead" rather than a raw error string.

**Layout:** same `ACXField` stack as `LoginView`. Password field with a mono `SHOW` / `HIDE` toggle,
never an eye glyph. Primary CTA hard-shadowed, disabled until valid.

**Acceptance:** a brand-new email creates an account and lands in onboarding. The confirmation-required
path is reachable and escapable.

---

### 5.3 ForgotPasswordView `[NEW]` · P1

Supabase `resetPasswordForEmail`. Single field, single CTA, then a terminal "email sent" state.
Linked from Login and from Settings.

---

### 5.4 OnboardingFlow `[NEW]` · P0 — 4 steps

**Purpose:** capture goal / level / cadence, and — more importantly — set up the habit before the
user hits an empty library.
**Entry:** first successful sign-in where `GET /onboarding` returns `has_completed: false`.
**Endpoints:** `GET /onboarding`, `POST /onboarding`.

The backend accepts exactly four fields — `learning_topics` (array, merged on upsert), `goal` (≤500),
`study_frequency` (≤100), `experience_level` (≤100). The flow must map 1:1; do not invent fields we
cannot persist.

| # | Step | Field | Input |
|---|---|---|---|
| 1 | "What are you studying?" | `learning_topics[]` | multi-select chips, **max 3**, free-text "Something else" |
| 2 | "How much do you already know?" | `experience_level` | 3 single-select rows: `NEW TO THIS` / `SOME BACKGROUND` / `REVISING` |
| 3 | "What are you working toward?" | `goal` | 4 rows: `AN EXAM` / `A COURSE` / `WORK` / `CURIOSITY` + optional date |
| 4 | "When will you study?" | `study_frequency` | `MORNING` / `MIDDAY` / `EVENING` + days-per-week stepper |

Step 4 doubles as the **notification-permission prime**: it explains *why* before the system prompt
and schedules the local reminder at the chosen time (§6.2). Ask for the system permission on the
screen *after* the choice, never on launch.

**Layout:** thin 2px accent progress bar pinned to the top with a back chevron; one question per
screen; option rows are square, ink-bordered, with a 2px accent left tick when selected; Continue is
disabled (ghost) until a selection exists.

**Mobbin references:**
- [Brilliant onboarding](https://mobbin.com/flows/7ffbd4f0-78d1-49be-bf0d-9c90cac00e8c) — the
  progress-bar + one-question-per-screen + disabled-Continue skeleton, and specifically its
  "How will learning fit into your day?" step, which is exactly our step 4.
- [Nibble onboarding](https://mobbin.com/flows/5df9112e-cba3-41a0-bad1-cf6ea08161e6) — the
  "choose up to 3 max" multi-select with an explicit cap in the subtitle (our step 1), and its
  notification-priming screen that states the benefit before the system dialog.
- [Preply onboarding](https://mobbin.com/flows/5739b0f1-089c-44b8-883b-cac14e9f38a5) — every step
  carries a visible **Skip this question**. Copy this: onboarding must never be a wall.

**Acceptance:** completing all 4 steps POSTs once with all four fields and never re-shows.
Skipping every step still completes and lands on Today. Killing the app mid-flow resumes at the
same step.

---

### 5.5 TodayView `[NEW]` · P0 — the new home

**Purpose:** answer "what should I study right now" in under one second.
**Entry:** tab 01, default tab after launch.
**Endpoints:** `GET /review/today?limit=20`, `GET /documents/progress/summary`, `GET /documents/`
(for the continue-session card), `POST /quiz/sessions/` with `mode: "review"`.

**Blocks, top to bottom:**

1. **Kicker + date** — `01 / TODAY` and the date in mono.
2. **Due card** — the hero. Due count as a large Space Mono numeral, `CONCEPTS DUE` beneath, and a
   hard-shadowed **Start review** CTA. Subtitle in mono: `REVIEW SESSIONS DON'T USE CREDITS` — this
   is true (`mode: "review"` bypasses the daily quota) and it is the single best thing we can tell a
   returning user.
   - **Zero due** is a *success* state, not empty: "Nothing due. You're ahead." + a ghost
     **Study anyway** that opens the library. Never render "0" as a failure.
3. **Credits row** — `CREDITS ●●●○○ 3 / 5` using filled/hollow squares (not hearts — squares are
   on-brand and the mechanic is Gizmo's, not the glyph). Tapping opens the credits sheet (§5.11).
4. **Streak row** — `STREAK 4 DAYS` with a 7-cell week strip, one cell per day, filled = studied.
   Local-only (§9.2). Reduce-motion-safe.
5. **Continue** — if an unfinished session exists, a card with the document title and
   `Q3 / 5` in mono → resumes via `GET /quiz/sessions/{id}/current`.
6. **Weakest concepts** — top 3 by lowest mastery from the due payload, each a row with the concept
   name and a mastery hairline bar. Tap → focused session on that concept
   (`focus_concept_ids: [id]`).

**Mobbin references:**
- [Imprint results/next-quiz card](https://mobbin.com/screens/15b9a264-4269-4942-9d08-7546f918b102)
  — "NEXT QUIZ IN 13h 52m 47s" plus a streak card and a notify-me toggle. This is the model for
  framing a quota as anticipation rather than denial.
- [Speak — streak + calendar](https://mobbin.com/screens/abf962e0-02c3-4dc1-95db-e4fd9ba1b96f) and
  [Quizlet streak calendar](https://mobbin.com/screens/7d8ebc3e-632a-44df-b20b-7b2b6bb7ae2e) — week
  strip and record framing. Take the *structure*; our cells are squares, our accent is emerald.

**Acceptance:** cold launch on an account with due concepts shows a non-zero count and starts a
review session in one tap. Quota is never consumed by this path. All five states designed.

---

### 5.6 LibraryView `[HAS — rework]` · P0

**Purpose:** manage source documents and start standard sessions.
**Endpoints:** `GET /documents/`, `GET /documents/progress/summary`, `DELETE /documents/{id}`.

**Changes from today's `DashboardView`:**
- **Activation checklist** at the top while the account is new — `ADD YOUR FIRST DOCUMENT` /
  `FINISH A QUIZ` / `COME BACK TOMORROW`, checked off as they complete, and it disappears for good
  after all three. This is the single highest-leverage empty-state fix.
- Each row gains: mastery hairline bar + `62%` in mono, concept count, and a `StatusPill` that
  actually reflects `pending` / `processing` / `ready` / `failed` (processing rows poll every 2s).
- Row tap → **DocumentDetailView** (today it starts a quiz immediately — wrong; that hides every
  concept and every session option).
- Swipe-to-delete with a confirm dialog → `DELETE /documents/{id}` (204).
- Pull-to-refresh (`.refreshable`), replacing the toolbar-only refresh.
- Toolbar `+` → upload sheet.
- **Empty state** is a real screen: crosshair-cornered drop zone, `NO DOCUMENTS YET`, and the two
  ingest CTAs (Files / Scan) as equal-weight buttons.

**Mobbin references:**
- [Speechify library](https://mobbin.com/screens/fc68b660-9afc-44d0-ba6b-2f31894a6e05) — the
  "Great start!" activation checklist above a document list where each row carries an inline %
  and file type. This is almost exactly our target row, minus the rounding.
- [Fabric](https://mobbin.com/screens/a74608cf-1e66-44e8-9b13-01b55d5e4c87) — per-file upload
  status rows with individual ✓ / progress, which is the right model for our async
  `pending → processing → ready` ingestion.

**Acceptance:** a document uploaded in this session appears without a manual refresh and transitions
`processing → ready` on its own. Mastery renders for documents that have been quizzed.

---

### 5.7 UploadFlow (sheet) `[NEW]` · P0 — **the other half of the fresh-account blocker**

**Purpose:** get a PDF/PPTX from the device into the pipeline.
**Endpoints:** Supabase Storage upload → `POST /documents/register` → poll `GET /documents/{id}`.

**Path (mirrors web, per architecture doc §1):**
1. Upload bytes directly to bucket `documents`, path `{user_id}/{document_id}/{filename}`.
   The server rejects paths not starting with `{user_id}/` (403) and `..` (400).
2. `POST /documents/register` with `{filename, file_path, file_type, file_size}`.
3. Poll `GET /documents/{id}` at 2s until `ready` or `failed`.

**Two ingest entries, presented as equal-weight buttons** (the competitor pattern is a *menu*, not a
single Upload button):
- **Files** — `.fileImporter`, UTTypes `pdf` + `presentationml.presentation`.
- **Scan** — `VNDocumentCameraViewController` → multi-page → PDF (issue #68).
  ⚠️ **Spike required before committing:** if VisionKit yields an image-only PDF, backend text
  extraction returns zero chunks and the document silently fails. Time-box 20 minutes; if OCR is
  needed, this drops to §9 and Files ships alone.

**States:** picking → uploading (determinate `ProgressHairline` from the Storage upload callback) →
registering → processing (indeterminate, with honest copy: "Reading your document. This takes about
a minute.") → ready (→ auto-open DocumentDetail) → failed (reason + retry).

**Error mapping — all three 429 shapes must be handled distinctly:**
| Condition | Response | UI |
|---|---|---|
| >20MB | 413 | "That file is over 20 MB." with the actual size in mono |
| wrong type | 400 | reject at the picker, never at the server |
| doc quota (default 2) | **429, `detail` is a string** | credits sheet framing: "You can keep 2 documents. Delete one to add another." + inline list to delete |
| per-minute limiter | 429, `detail` is a string | silent backoff + retry, no user-facing error |

**Acceptance:** a real PDF from Files reaches `ready` and is immediately quizzable. Backgrounding the
app mid-upload does not corrupt state. All four errors render designed states, never a raw `detail`.

---

### 5.8 DocumentDetailView `[NEW]` · P0

**Purpose:** the mastery surface — this is where AutoCoach stops looking like a quiz app.
**Endpoints:** `GET /documents/{id}`, `GET /documents/{id}/concepts`, `GET /documents/{id}/progress`,
`POST /quiz/sessions/`.

**Layout:**
- Header: `ai_title` (fallback `filename`) in display, file type + size + date in mono.
- **Mastery block:** `mastery_percent` as a large mono numeral over a full-width hairline bar;
  beneath it a mono stat row `CONCEPTS 24 · PRACTISED 11 · WEAK 4 · MASTERED 6`; a `MilestoneBadge`
  when `milestone != "none"` (25/50/75/100).
- **Concept table:** one row per concept — name, `ImportanceDots` (from `importance_score`), a
  `CoreBadge` when `is_core`, mastery bar, and `times_correct/times_tested` in mono. Sort: weakest
  first (that is the useful order, not alphabetical). Multi-select up to **3** concepts → the
  selection becomes `focus_concept_ids` on the session.
- **Sticky footer:** hard-shadowed **Start quiz** + a ghost **Options** that opens the session config
  sheet.

**Acceptance:** concepts render with real mastery. Selecting 2 concepts and starting a quiz produces
questions on those concepts (verify `focus_concept_ids` reaches the request).

---

### 5.9 SessionConfigSheet `[NEW]` · P1 — cheapest differentiator in the doc

`POST /quiz/sessions/` already accepts `num_questions` (1–20), `difficulty` (easy/medium/hard),
`question_types[]`, and `focus_concept_ids` (max 3). **The iOS client hardcodes all of them.**

A short sheet exposing: length stepper, three difficulty segments, three type toggles (MCQ /
TRUE-FALSE / WRITTEN), and the focus-concept selection carried from DocumentDetail. Remember the last
choice in `@AppStorage`.

**Mobbin reference:** NotebookLM's flashcard generation controls (count: fewer/standard/more;
difficulty) — users value the knob even when the default is already right (t01 §1.9).

---

### 5.10 QuizSessionView `[HAS — extend]` · P1

Keep `QuizEngine` and the state machine as-is; they are correct and mirror the web's hard-won
invariants. Additions:

- **Session progress** as a thin 2px accent bar with `Q3 / 5` in mono (today it is text only).
  Reference: [Speechify](https://mobbin.com/screens/7098210e-e083-4635-badd-e77692e3474c) —
  "Question 2 of 10" over a thin bar with an X close, and A/B/C/D lettered option rows, which
  matches our MCQ contract exactly (`correct_answer` is `A|B|C|D`).
  Structural reference for our brutalist option rows:
  [Udemy](https://mobbin.com/screens/bc8c50bb-c999-46da-b418-8420dfa4bee9) — square bordered rows,
  square footer buttons.
- **In-session answer streak** — a mono counter that increments on consecutive correct answers and
  resets on a miss. Costs nothing server-side, visibly lifts effort (Quizlet's mechanic).
- **CoreHaptics** on verdict — `.success` / `.error`. 30 minutes of work, disproportionate perceived
  quality.
- **Grading state must stay honest:** `is_correct` is tri-state. On `gradingTimedOut` show
  "Still grading" with a manual re-check — never render a false verdict. Reserve no layout for
  `correct_answer`/`explanation` while pending (the server withholds them as a leak guard).
- **Resume:** on appear with an existing session id, call `GET /quiz/sessions/{id}/current` first.
- **`rendered` question type** must render an explicit "Not supported yet" card, not a free-text
  field (today `Question.kind` silently falls back to `.freeText`).
- **Live Activity** (P2, §6.3).

---

### 5.11 ResultsView `[HAS — extend]` + CreditsSheet `[NEW]` · P1

`GET /quiz/sessions/{id}` already returns the full per-question breakdown.

**Results additions:**
- **Score block** — big mono percentage with a square segmented meter (not a donut — donuts are
  round and off-brand). `8 / 10 CORRECT` beneath.
- **Next steps as action cards** — `Retry the ones you missed` (new session with
  `focus_concept_ids` = concepts of wrong answers) and `Review this document`. Reference:
  [Quizlet results](https://mobbin.com/screens/d0797186-4573-4cc2-b758-59adf0cceced) — score,
  correct/incorrect counts, then explicit "Next steps" cards, then the answer list.
- **Per-question list** — collapsed rows with ✓/✗, expanding to show the user's answer, the correct
  answer, and the explanation in a `WhyInset`. Reference:
  [Speechify results](https://mobbin.com/screens/9ca89885-f158-450c-a687-503bd97bdb8d).
- **XP earned** — sum of `xp_awarded` across the session, in mono, with the running total.
- `session_ended_reason` must be surfaced honestly: `mastery_threshold` reads "You've got this —
  ended early", `cap_reached` reads "Session complete".

**CreditsSheet** — reachable from Today, from Results, and from any daily-quota 429:
- `CREDITS 0 / 5` and `RESETS IN 13h 52m` (computed client-side from midnight UTC — no endpoint).
- `XP 240` with a hard-shadowed **Redeem 100 XP → +1 quiz** CTA calling `POST /xp/redeem`.
  Handle 400 (insufficient), 404, and **409 concurrent-update as retryable** (retry once, silently).
- Reminder that review sessions are free, with a CTA straight into one.

This sheet is where a 429 goes. **A daily-quota 429 must never surface as an alert.**
Reference for the framing: [Imprint](https://mobbin.com/screens/15b9a264-4269-4942-9d08-7546f918b102).

---

### 5.12 ProfileView + SettingsView `[NEW]` · P1 (issue #66)

**Profile:** email, member-since, aggregate mastery across documents
(`GET /documents/progress/summary`), XP balance, streak, and the credits row.

**Settings:** study reminder time + days (writes local notifications), change password
(`resetPasswordForEmail`), analytics opt-out, Terms, Privacy, **Sign out** (destructive, confirm
dialog), delete-account link to web, and a mono build-version footer.

**Legal:** Terms and Privacy as native scroll views, not web views — required for App Store review
and linked from Welcome/Signup.

---

## 6. Native affordances (P2 — after §5 is complete and shipping)

### 6.1 Home Screen + Lock Screen widget (WidgetKit)
Due count + streak + one-tap into today's review. Duolingo's streak widget is associated with a ~60%
lift in daily-open commitment; Quizlet built one specifically for this. Requires an **App Group** and
a **Keychain access group** — neither exists in `project.yml` today, so add them in the foundation
lane even if the widget ships later. Data via a shared cache refreshed by `BGAppRefreshTask`.

### 6.2 Local notifications (UNUserNotificationCenter)
Scheduled locally from the due queue at the time chosen in onboarding step 4. **No APNs, no device
tokens, no backend.** Rotate the copy across a small portfolio of hooks rather than repeating one
nag — Knowt's App Store reviews are the cautionary tale for over-notifying. Cap at one per day.

### 6.3 Live Activity for an in-progress session (ActivityKit)
Q-number, accuracy, elapsed on the Lock Screen and Dynamic Island. Makes the background
question-generation long-poll visible instead of a spinner. Fully client-side.

### 6.4 Share Extension
"Open in AutoCoach" from Safari, Mail, Files. Uses the same Storage-upload + `/register` path, so
the cost is entirely in the App Group + Keychain access-group plumbing — which is why §6.1 pays for
it. Knowt's #1 acquisition lever is importer-as-onboarding; this is our version.

### 6.5 App Intents / Siri / Spotlight
"Hey Siri, start my AutoCoach review." Interactive widget buttons need App Intents anyway, so this is
shared work with §6.1. Spotlight-index document titles and concepts.

**Not doing:** Apple Watch (free-text answers and MCQ reading are wrong for the wrist), Handoff
(needs matching web activities), Focus filters.

---

## 7. Design-system work required (`Design/ACX.swift`)

**Present:** `ACXColor`, `ACXFont` (system fallback), `HardShadow`, `Kicker`, `Hairline`,
`StatusPill`, `PrimaryButtonStyle`, `GhostButtonStyle`, `GroundBackground`, `ACXField`.

**Missing — must be built in the foundation lane before any feature lane starts:**

| Primitive | Used by | Spec |
|---|---|---|
| **Bundled fonts** (issue #67) | everything | Space Grotesk / Inter / Space Mono TTFs (OFL), `UIAppFonts` via `project.yml` plist properties, `ACXFont` switched off system fallbacks, all with `relativeTo:` for Dynamic Type |
| `ProgressHairline` | upload, quiz, mastery | 2px, accent fill on surface track, zero radius, determinate + indeterminate |
| `MasteryBar` | library rows, doc detail, concepts | hairline + mono % label |
| `ScoreMeter` | results | square segmented meter — **not** a donut |
| `MilestoneBadge` | doc detail, library | square ink-bordered 25/50/75/100 |
| `ImportanceDots` / `CoreBadge` | concept table | square dots; mono `CORE` tag |
| `WhyInset` | results, session | explanation callout, accent left tick |
| `CornerCrosshair` | upload empty state | decorative corner marks |
| `ACXToast` / `ACXConfirmDialog` | delete, sign out, upload complete | zero-radius, ink-bordered |
| `SegmentedControl` | session config | square segments, accent fill on selection |
| `CreditPips` | Today, credits sheet | filled/hollow squares |
| `WeekStrip` | Today, profile | 7 square cells |
| `EmptyState` | library, today, review | kicker + line + one CTA, reusable |

**Invariants to enforce in review:** zero radii everywhere (the only round element in the app is the
`StatusPill` dot); hard shadow on the primary CTA and the active quiz card *only*; exactly one accent
per view; Space Mono for **all** numerals; no gradients, no `.regularMaterial`, no `.glassEffect`;
44pt hit targets; Dynamic Type via `relativeTo:`; Reduce Motion gates every animation; VoiceOver
labels on option rows with verdicts announced via `AccessibilityNotification.Announcement`.
`Muted` on `Ground` fails 4.5:1 at small sizes — data labels in Muted must be ≥ footnote and
non-essential.

---

## 8. Phasing

**Phase 0 — Foundation (serialized, must land first).** One lane. Touches the shared files every
other lane depends on, so nothing else may start until it merges.
- Bundle the three TTFs, wire `UIAppFonts`, switch `ACXFont` off system fallbacks (#67).
- Build every missing `ACX` primitive in §7.
- Add `MainTabView` + the `RootView` routing switch (loading / signedOut / needsOnboarding / signedIn).
- Add App Group + Keychain access group to `project.yml` now, so §6 is unblocked later.
- Extend `Networking/Models.swift` with onboarding, XP, review, concepts and progress types.

**Phase 1 — Unblock the fresh account (parallel, 3 lanes).** After this the app is usable by a
brand-new user, which it is not today.
- Lane A: Welcome + Signup + ForgotPassword + Sign in with Apple (§5.1–5.3)
- Lane B: OnboardingFlow (§5.4) — issue #64's sibling
- Lane C: UploadFlow, Files path only (§5.7) — issue #64

**Phase 2 — Surface the moat (parallel, 3 lanes).**
- Lane D: TodayView (§5.5) — issue #65
- Lane E: LibraryView rework + DocumentDetailView (§5.6, §5.8)
- Lane F: ProfileView + SettingsView + CreditsSheet + Legal (§5.12, §5.11) — issue #66

**Phase 3 — Polish (parallel).** SessionConfigSheet, Quiz/Results extensions, haptics, resume,
VisionKit scan if the spike passes (#68).

**Phase 4 — Native surfaces (§6).** Widget, notifications, Live Activity, Share Extension, App Intents.

**Lane isolation rule:** lanes must not share files. Feature lanes own
`ios/AutoCoach/<Feature>/**` only. `Design/ACX.swift`, `Networking/Models.swift`, `App/AppRoot.swift`
and `project.yml` belong to Phase 0 exclusively. Any lane needing a change to those files stops and
reports instead of editing.

---

## 9. Out of scope — needs the backend unfrozen

1. **Subscription entitlements.** StoreKit can present and purchase; the 5/day quota is enforced in
   Postgres, so a purchase changes nothing server-side. Paywall *design* can proceed; wiring cannot.
2. **Cross-device streak durability.** No endpoint exposes per-day activity. A local streak dies on
   reinstall or device change. Ship it local, label the limitation, revisit.
3. **Fast recall / flashcard mode.** Every question today is LLM-generated per turn; this needs a
   cheap non-LLM item endpoint.
4. **Source-chunk citation under an answer.** Retrieval already selects the chunk; the API does not
   return it. Small backend change, high perceived value — best candidate when the freeze lifts.
5. **New ingest types** — YouTube links, lecture audio (needs transcription).
6. **Quizlet / Anki import** — Knowt's #1 acquisition lever, entirely a backend content path.
7. **Audio / podcast mode.**
8. **Social** — leaderboards, friends, shared decks, live multiplayer.
9. **Time-series stats** beyond what `/progress/summary` already aggregates.
10. **Server-triggered push.** Local notifications avoid this entirely, which is why they are in scope.

---

## 10. Known risks

- **VisionKit → image-only PDF ⇒ zero chunks.** Spike before committing #68. May become a backend
  (OCR) item.
- **`APIClient.send` force-casts `URLResponse as! HTTPURLResponse`** — crash on a non-HTTP response.
  Fix in Phase 0.
- **`APIClient` collapses all `perform` errors into `.network`**, swallowing `configMissing`.
- **`SpeechRecognizer.start()` force-unwraps `recognizer!`** after an availability guard — trap if
  availability flips.
- **`Question.kind` silently maps unknown types (including `rendered`) to `.freeText`.**
- **`nonisolated(unsafe)` task handles** in `QuizEngine` and `AuthStore` — justified in comments,
  still unchecked by the compiler.
- **Competitive research provenance:** competitor onboarding descriptions in `t01.result.md` are
  reconstructed from documentation and review blogs, not first-hand device runs; the paywall
  conversion benchmarks come from vendor blogs and are directionally useful only. A 30-minute
  first-run teardown of Knowt / Gizmo / Duolingo on a clean device would materially upgrade this.

---

## 11. Mobbin reference index

Re-fetch these when building the corresponding screen. Cited for **structure and information
hierarchy only** — every one of them must be re-skinned to Quiet Brutalism (zero radii, no
gradients, no blurred shadows, single emerald accent).

| Screen being built | Reference | What to take |
|---|---|---|
| Welcome / Signup | [Brilliant onboarding flow](https://mobbin.com/flows/7ffbd4f0-78d1-49be-bf0d-9c90cac00e8c) | social row → OR rule → email; "Existing user? Log in" as footer |
| Onboarding | [Brilliant onboarding flow](https://mobbin.com/flows/7ffbd4f0-78d1-49be-bf0d-9c90cac00e8c) | top progress bar, one question per screen, disabled Continue, "how will learning fit into your day" |
| Onboarding | [Nibble onboarding](https://mobbin.com/flows/5df9112e-cba3-41a0-bad1-cf6ea08161e6) | "choose up to 3 max" cap in the subtitle; notification priming that states the benefit first |
| Onboarding | [Preply onboarding](https://mobbin.com/flows/5739b0f1-089c-44b8-883b-cac14e9f38a5) | per-step "Skip this question" |
| Today | [Imprint](https://mobbin.com/screens/15b9a264-4269-4942-9d08-7546f918b102) | "NEXT QUIZ IN 13h 52m" + streak card + notify toggle — quota as anticipation |
| Today / Profile | [Speak streak](https://mobbin.com/screens/abf962e0-02c3-4dc1-95db-e4fd9ba1b96f) · [Quizlet streak](https://mobbin.com/screens/7d8ebc3e-632a-44df-b20b-7b2b6bb7ae2e) | week strip, records framing |
| Library | [Speechify library](https://mobbin.com/screens/fc68b660-9afc-44d0-ba6b-2f31894a6e05) | activation checklist above the list; inline % + type per row |
| Upload | [Fabric](https://mobbin.com/screens/a74608cf-1e66-44e8-9b13-01b55d5e4c87) | per-file async status rows |
| Quiz | [Speechify quiz](https://mobbin.com/screens/7098210e-e083-4635-badd-e77692e3474c) | "Question 2 of 10" + thin progress + A/B/C/D lettered rows |
| Quiz | [Udemy quiz](https://mobbin.com/screens/bc8c50bb-c999-46da-b418-8420dfa4bee9) | square bordered option rows, square footer buttons — closest existing app to our brand |
| Results | [Quizlet results](https://mobbin.com/screens/d0797186-4573-4cc2-b758-59adf0cceced) | score → "Next steps" action cards → answer list |
| Results | [Speechify results](https://mobbin.com/screens/9ca89885-f158-450c-a687-503bd97bdb8d) | expandable per-question rows with ✓/✗ |
| Credits / paywall (later) | [Todoist Pro](https://mobbin.com/screens/52a8306d-2104-42c6-98ce-0a99d6c7b023) | two square plan cards, one marked with a saving — square already, minimal re-skin |

---

## 12. Decisions (settled 2026-07-27)

1. **Auth: Sign in with Apple + email/password.** No Google. Apple is Supabase provider config only
   — zero backend code. Lane A owns `SignInWithAppleButton` + the Supabase
   `signInWithIdToken(credentials:)` exchange, plus the nonce handling Apple requires.
2. **Streak: ship local, label the limitation.** Local streak *with* freeze on Today and Profile,
   persisted to the App Group container (not `UserDefaults`, so the widget can read it). Settings
   carries one honest mono line: `STREAK IS STORED ON THIS DEVICE`. Swap to a durable source when
   the backend can record per-day activity (§9.2).
3. **Scan (#68): settled without a spike — see below.** Build it in Phase 3 with on-device OCR.
4. **Deployment target stays iOS 18** (M1 decision, unchanged).
5. **Build depth: through Phase 2, then human review.** Foundation + fresh-account unblock +
   Today/Library/DocumentDetail/Profile. Each lane verified with a simulator build, merged to one
   integration branch, QA checklist handed over. Nothing lands on `dev` without review.

### 12.1 Camera scan — resolved, and it is client-only

The risk in §10 was that VisionKit yields an image-only PDF, backend extraction finds no text, and
the document silently ingests as zero chunks. That is **correct and certain, not a maybe**:
`VNDocumentCameraViewController` hands back `UIImage` pages, and a PDF assembled from them has no
text layer by construction. A naive scan → PDF → `/documents/register` would fail every time.

It does **not** need a backend OCR change. The fix is on-device and free:

1. Run `VNRecognizeTextRequest` (Vision, `.accurate`, on-device, no network, no cost) over each
   scanned page.
2. Assemble the PDF with the recognized text drawn as an **invisible text layer**
   (`kCGTextInvisible`) positioned over each page image — a standard searchable-PDF construction.
3. Register as normal. The backend's existing PDF text extraction reads the text layer and chunks it
   exactly like any other PDF. No API change, no new endpoint.

**Acceptance gate for Phase 3:** after registering a scanned document, `GET /documents/{id}` must
report `chunk_count > 0`. If it reports 0, the OCR layer is not landing and scan does not ship — do
not paper over it with a UI message. Add a pre-flight client-side guard: if Vision recognizes fewer
than ~20 characters across all pages, block the upload with "We couldn't read any text on this page"
rather than burning the user's 2-document quota on a dead file.
