# AutoCoach North Star Design + Experience Framework (NDEF)

> **Status:** REFERENCE. This document defines the product-level design direction for every route in AutoCoach.
> **Last updated:** 2026-02-06
> **Companion docs:** [ui-lock.md](./ui-lock.md) (enforcement rules, tokens) · [component-catalog.md](./component-catalog.md) (registry inventory)

---

## 1. Brand + UX Tone

AutoCoach is a **calm, premium, coach-like** learning tool. It should feel like a focused study room, not a game show.

| Attribute | Expression |
|-----------|-----------|
| Calm | Dark surfaces reduce visual noise. Generous whitespace. No competing animations. |
| Premium | Playfair Display serif for display type. Warm brand palette (#cd776a copper, #c18c5d gold). Subtle motion. |
| Coach-like | Encouraging copy ("Ready to learn?", "Outstanding!"). Progress-forward UI — always showing the next action. |
| Dark-first | All protected surfaces use the v2 dark token set (`--surface-dark: #34344a`). Light mode is not supported. |
| Clarity > Decoration | Every element must earn its pixel. If a visual treatment doesn't improve comprehension or navigation, remove it. |

---

## 2. UX Principles

1. **One primary action per screen.** Every page has exactly one thing the user should do next. Make it obvious.
2. **Progress is always visible.** Steppers, progress bars, score circles — the user should never wonder "where am I?"
3. **Errors are recoverable.** Every error state includes a retry action or a path back to safety. No dead ends.
4. **Load states are structural.** Use skeleton screens that match the layout of incoming content, not spinners on blank pages.
5. **Empty states are invitations.** When there's no data, show a clear CTA to create it — not just "Nothing here."
6. **Feedback is immediate.** Answer submission shows instant feedback (correct/incorrect + explanation) before moving to the next question.
7. **Navigation is predictable.** Back buttons always go one level up. The AppShell nav stays consistent across all protected routes.

---

## 3. Motion Principles

Distilled from [ui-lock.md §6](./ui-lock.md) and `src/lib/motions.ts`:

1. **Motion communicates, never decorates.** State changes, attention guidance, and spatial orientation are the only valid reasons for motion.
2. **One-shot only.** Scroll reveals fire once and stick. No re-triggering, no looping (loading spinners exempted).
3. **Subtle transforms.** Max `-4px` Y-lift on hover. Max `1.02` scale. Transitions ≤ `0.3s` for interactions, ≤ `0.6s` for reveals.
4. **Centralized presets.** All durations and easing curves come from `src/lib/motions.ts`. Zero inline `transition={{ }}` definitions in components.
5. **Respect `prefers-reduced-motion`.** Framer Motion handles this by default. Never override it.

**Duration budget:** Scroll reveals ≤ 0.6s · Hover/tap ≤ 0.3s · Page transitions ≤ 0.6s · Count-up ≤ 1.5s

---

## 4. Information Architecture Map

```
                            ┌──────────────┐
                            │  / (Landing)  │
                            └──────┬───────┘
                                   │
                        ┌──────────┴──────────┐
                        ▼                     ▼
                  ┌──────────┐          ┌──────────┐
                  │  /login   │◄────────►│  /signup  │
                  └────┬─────┘          └────┬─────┘
                       │                     │
                       └──────────┬──────────┘
                                  ▼
                          ┌──────────────┐
                          │  /dashboard   │◄──────────────────────────────┐
                          └──────┬───────┘                               │
                                 │                                       │
                    ┌────────────┼────────────┐                          │
                    ▼            ▼            ▼                          │
              ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
              │  /upload   │ │ /settings │ │ Continue │                    │
              └────┬─────┘ └──────────┘ │ Learning │                    │
                   │                     └────┬─────┘                    │
                   ▼                          │                          │
              ┌──────────┐                    │                          │
              │  /config   │◄─────────────────┘                          │
              └────┬─────┘                                               │
                   │                                                     │
                   ▼                                                     │
              ┌──────────┐                                               │
              │  /session  │                                              │
              └────┬─────┘                                               │
                   │                                                     │
                   ▼                                                     │
              ┌──────────┐      ┌─────────────┐                          │
              │  /results  │─────►│  Try Again   │──► /config ───────────┘
              └────┬─────┘      └─────────────┘
                   │
                   └──► /dashboard
```

### Route inventory

| Route | Layout | Status | Section |
|-------|--------|--------|---------|
| `/` | Root (no AppShell) | Production | §5 |
| `/login` | Auth (split-screen) | Production | §5.1 |
| `/signup` | Auth (split-screen) | Production | §5.1 |
| `/dashboard` | AppShell | Production | §6 |
| `/upload` | AppShell | Production | §7.1 |
| `/config` | AppShell | Production | §7.2 |
| `/session` | AppShell | Production | §7.3 |
| `/results` | AppShell | Production | §7.4 |
| `/settings` | AppShell | Production | §6.1 |
| `/analytics` | Custom (no AppShell) | Prototype — rebuild | §8 |
| `/feedback` | Custom (no AppShell) | Prototype — delete | §8 |
| `/dev/blocks` | AppShell | Internal tool | — |

---

## 5. Landing Page Spec

The landing page is the only public-facing surface. It uses the legacy token set (frozen — see ui-lock.md §1) and does not use AppShell. The page currently lives as a single 1500+ line `page.tsx` with inline section components — **extracting these into `components/features/landing/` is a prerequisite for any further iteration.**

### 5.1 Auth Pages (Login / Signup)

**Layout:** Split-screen. Left panel is decorative (gradient mesh, logo, feature highlights, testimonial). Right panel is the form. Left panel is hidden on mobile.

| Element | Current state | North star |
|---------|--------------|------------|
| Social login (Google, Apple) | Placeholder — shows "coming soon" toast | Wire to Supabase OAuth when ready |
| Forgot password | Links to `#` | Implement Supabase password reset flow |
| Terms & Privacy links | Link to `#` | Create actual pages or link to hosted docs |
| Password strength | Custom indicator | Keep — works well, shows requirements checklist |
| Form validation | `useState`-driven | Migrate to react-hook-form + zod (ui-lock §5) |

**Recommended components:** `input` [I], `label` [I], `button` [I], `dialog` [I] (for modals). When forms are migrated: `form` (TBD), `input-otp` (TBD) for email verification.

### 5.2 Section-by-Section Spec

#### Navigation

| | |
|---|---|
| **Goal** | Anchor user in brand, provide quick access to sections and auth |
| **Content** | Logo · section anchors (Features, How It Works, Pricing, FAQ) · Login / Get Started buttons |
| **CTA** | "Get Started Free" → `/signup` |
| **Components** | Custom sticky nav (current). Candidate: `navigation-menu` (@shadcn, TBD) for accessible dropdown support. |
| **Motion** | Background opacity transition on scroll (current — keep). |

#### Hero

| | |
|---|---|
| **Goal** | Communicate the value proposition in < 5 seconds |
| **Content** | Headline (serif, large) · Subheadline (1 sentence) · Primary CTA · Secondary CTA · Decorative elements |
| **CTA** | Primary: "Start Learning Free" → `/signup`. Secondary: "See How It Works" → scroll anchor |
| **Components** | Custom (current). Candidate landing blocks from `@bundui` or `@shadcraft` are TBD — evaluate before adopting. |
| **Motion** | Staggered fade-in for text elements. Animated decorative shapes. Keep subtle — hero should load fast and be readable immediately. |

#### Value Propositions / Features

| | |
|---|---|
| **Goal** | Show the three core capabilities (upload, AI quiz, instant feedback) |
| **Content** | 6 feature cards with icons, titles, descriptions |
| **CTA** | None — informational |
| **Components** | `card` [I] · `badge` [I] for tags · Lucide icons |
| **Motion** | `InView` scroll reveal, stagger children. One-shot, `amount: 0.3`. |

#### How It Works

| | |
|---|---|
| **Goal** | Reduce perceived complexity — "it's just 3 steps" |
| **Content** | 3 numbered steps: Upload → Configure → Learn |
| **CTA** | None — flows into demo section |
| **Components** | Custom step cards (current). `stepper` [I] from @formcn could replace if visual weight is appropriate. |
| **Motion** | Sequential reveal on scroll. |

#### Interactive Demo

| | |
|---|---|
| **Goal** | Show the product in action without requiring signup |
| **Content** | 5-stage animated walkthrough (upload → processing → question → answer → results) |
| **CTA** | "Try It Yourself" → `/signup` |
| **Components** | Custom (current — complex animation sequence). Keep as custom. |
| **Motion** | Stage transitions. Scoped to demo container — should not compete with surrounding sections. |

#### Social Proof / Testimonials

| | |
|---|---|
| **Goal** | Build trust through peer validation |
| **Content** | 4 testimonial cards (currently hardcoded — Sarah Chen, James Wilson, Maria Garcia, David Park) |
| **CTA** | None |
| **Components** | `card` [I] · `star-rating` [I] from @shadcraft · Candidate: `avatar-stack` (@shadcraft, TBD), `carousel` (@shadcn, TBD) for mobile slider |
| **Motion** | Scroll reveal. Cards may use hover lift (≤ 4px Y-translate). |
| **Note** | Testimonials are placeholder data. Replace with real testimonials or remove section before public launch. |

#### Pricing

| | |
|---|---|
| **Goal** | Convert visitors to signups. Make free tier feel generous. |
| **Content** | 2 plans: Free ($0) and Pro ($9/mo or $7/mo yearly). Monthly/yearly toggle. Feature comparison list. |
| **CTA** | Free: "Get Started" → `/signup`. Pro: "Start Free Trial" → `/signup` |
| **Components** | `card` [I] · `badge` [I] for "Most Popular" label · `separator` [I] · Custom toggle (current) |
| **Motion** | Scroll reveal for cards. Subtle highlight animation on recommended plan. |
| **Note** | Pricing is hardcoded. Subscription upgrade is not yet functional (settings page shows "coming soon"). |

#### FAQ

| | |
|---|---|
| **Goal** | Answer objections and reduce support load |
| **Content** | 6 accordion items covering common questions |
| **CTA** | None |
| **Components** | `accordion` [I] — already uses Radix, accessible. |
| **Motion** | Accordion expand/collapse (built into Radix). Section scroll reveal. |

#### Final CTA

| | |
|---|---|
| **Goal** | Last conversion opportunity before footer |
| **Content** | Headline · Value reinforcement · Primary CTA button |
| **CTA** | "Start Learning Now" → `/signup` |
| **Components** | Custom section (current). |
| **Motion** | Scroll reveal. Button hover effect. |

#### Footer

| | |
|---|---|
| **Goal** | Navigation, legal links, social proof reinforcement |
| **Content** | Logo · Link columns (Product, Company, Legal) · Social links · Newsletter signup · Copyright |
| **CTA** | Newsletter email capture |
| **Components** | Custom (current). Links currently point to `#` — wire to real pages or remove. |
| **Motion** | None. Footer should be static. |

---

## 6. Dashboard Spec

The dashboard is the user's home after login. It uses AppShell (sticky top nav with avatar dropdown, no sidebar).

### Layout

```
┌─────────────────────────────────────────────────────┐
│  AppShell Nav  [Logo]  [Title]           [Avatar ▼] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Hero: "Ready to learn, {name}?"     [+ Study New]  │
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │Documents │  │  Ready   │  │Processing│            │
│  │   {n}    │  │   {n}    │  │   {n}    │            │
│  └─────────┘  └─────────┘  └─────────┘             │
│                                                     │
│  Continue Learning (if recent document exists)      │
│  ┌──────────────────────────────────────────┐       │
│  │  {document name}           [Start Quiz →]│       │
│  └──────────────────────────────────────────┘       │
│                                                     │
│  Your Documents                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Doc Card │  │ Doc Card │  │ Doc Card │           │
│  │ status   │  │ status   │  │ status   │           │
│  │ [Quiz] …│  │ [Quiz] …│  │ [Quiz] …│            │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Modules

| Module | Content | Components |
|--------|---------|-----------|
| **Stats grid** | 3 cards: total documents, ready count, processing count. | `card` [I]. Candidate: `stat-cards-01` [I] from @bundui (approved in ui-lock) for richer presentation with deltas. |
| **Continue Learning** | Shows most recent "ready" document with a "Start Quiz" CTA. Hidden if no documents are ready. | `card` [I] with hover lift. |
| **Documents grid** | Responsive card grid of all user documents. Each card shows filename, file type icon, status badge, upload date, and actions (Start Quiz, Delete). | `card` [I] · `badge` [I] (status: ready/processing/failed) · `dropdown-menu` [I] for actions · `dialog` [I] for delete confirmation |
| **Empty state** | Shown when user has zero documents. Illustration + "Upload your first document" CTA → `/upload`. | Custom (current). Candidate: `empty` (@shadcn, TBD). |

### Spacing & card hierarchy

- Stats grid: `gap-6`, 3 columns on desktop → stack on mobile.
- Document cards: `gap-6`, 3 columns → 2 → 1 responsive.
- Card surface: `bg-surface-card` with `border-surface-border`. Hover lift approved (≤ 4px).
- Section spacing: `space-y-8` between major sections.

### Scale considerations

Currently the dashboard shows all documents in a flat grid. As users accumulate documents:

- **Pagination** — add when document count can exceed ~20. Use `pagination` (@shadcn, TBD).
- **Search / Filter** — add document name search and status filter. Use `input` [I] + `dropdown-menu` [I].
- **Table view** — offer list/grid toggle for power users. Use `table` (@shadcn, TBD) + `tabs` [I] for view switching.

### 6.1 Settings Page

**Route:** `/settings` · **Layout:** AppShell with back button → `/dashboard`

| Section | Content | State |
|---------|---------|-------|
| Profile | Avatar upload/delete, email display | Functional |
| Security | Password reset button | Functional (triggers Supabase email) |
| Subscription | "Free Plan" badge, disabled "Upgrade" button | Placeholder — upgrade not implemented |

**Components:** `card` [I] · `button` [I] · `badge` [I] · `avatar` [I] · `dialog` [I] for confirmations

---

## 7. Study Flow Spec

The core product loop: Upload → Configure → Session → Results. Each step flows into the next with clear back-navigation.

### 7.1 Upload

**Route:** `/upload` · **Layout:** AppShell with back → `/dashboard`

| State | UI | Components |
|-------|-----|-----------|
| **Idle** | Drop zone with dashed border, file type hints (PDF, PPTX), browse button | Custom drop zone. Candidate: built on `input` [I]. |
| **Uploading** | Progress bar, filename, percentage | `progress` [I] · Custom upload animation |
| **Processing** | DiamondSpinner, "Processing your document..." message, progress bar | Custom `DiamondSpinner` · `progress` [I] |
| **Success** | Checkmark animation → auto-redirect to `/config?document_id=...` after 1.5s | Custom animation |
| **Error** | Error message + "Try Again" button | Custom `ErrorCard` · `button` [I] |

**Tips section:** 3 cards below the drop zone with upload guidance (file size limits, supported formats, tips for better results).

**Motion:** Upload progress is animated. Success state uses a checkmark entrance animation. Auto-redirect uses `transitions.expo` timing.

### 7.2 Config (Quiz Setup)

**Route:** `/config?document_id=...` · **Layout:** AppShell

| Step | Options | UI |
|------|---------|-----|
| 1. Questions | 5, 10, 15, 20, custom (3–50) | `OptionPill` buttons (custom) |
| 2. Difficulty | Easy, Medium, Hard | `DifficultyCard` cards (custom) with icon + description |
| 3. Types | MCQ, True/False, Free Text (multi-select) | `OptionPill` buttons with `checkbox` [I] behavior |
| 4. Timer | None, 1min, 3min, 5min, 10min | `OptionPill` buttons |

**Layout:** Two-column on desktop. Left column: vertical `stepper` [I] from @formcn (clickable — users can jump between steps). Right column: step content with option selection.

**Components:** `stepper` [I] · `button` [I] (Back / Continue / Start Quiz) · Custom `OptionPill` and `DifficultyCard`

**Motion:** Step transitions use slide animation. Stepper updates state indicator. "Start Quiz" button triggers session creation → redirect to `/session`.

### 7.3 Session (Active Quiz)

**Route:** `/session?session_id=...&t=...` · **Layout:** AppShell

```
┌─────────────────────────────────────────────────────┐
│  Question {n} of {total}        Score: {x}   ⏱ {t}  │
│  ═══════════════════════▓▓▓░░░░░░░░░░░░░░░░░░░░░░░  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │              QuestionCard                    │    │
│  │                                             │    │
│  │  {question text}                            │    │
│  │                                             │    │
│  │  ○ Option A                                 │    │
│  │  ● Option B  ← selected                    │    │
│  │  ○ Option C                                 │    │
│  │  ○ Option D                                 │    │
│  │                                             │    │
│  │                          [Submit Answer →]  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │          FeedbackPanel (after submit)        │    │
│  │  ✓ Correct! +1                              │    │
│  │  Explanation: ...                           │    │
│  │                          [Next Question →]  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Question types:**

| Type | Input | Components |
|------|-------|-----------|
| MCQ | Select one of 4 options | Custom `OptionPill` (radio behavior). Candidate: `radio-group` (@shadcn, TBD) |
| True/False | Select True or False | Custom `OptionPill` (radio behavior) |
| Free Text | Text area for open-ended answer | `textarea` [I] |

**Timer:** Countdown displayed in header (if configured). Persists via `localStorage` across page refreshes. When timer expires, "Time's Up" overlay appears → auto-redirect to `/results`.

> **Known limitation:** Timer is client-only. Backend does not validate time limits. A determined user could bypass it. Backend validation is recommended for future hardening.

**States:**

| State | Behavior |
|-------|----------|
| Loading | `QuestionCardSkeleton` (skeleton matching card layout) |
| Answering | Submit button disabled until an answer is selected/typed |
| Submitted | FeedbackPanel slides up with correct/incorrect, explanation, next button |
| Last question | "See Results" button instead of "Next Question" |
| Time's up | Full-screen overlay → redirect to `/results` |

**Motion:** FeedbackPanel entrance: slide up with `transitions.smooth`. Progress bar: width transition on each question. Score counter: increment animation.

### 7.4 Results

**Route:** `/results?session_id=...` · **Layout:** AppShell

```
┌─────────────────────────────────────────────────────┐
│  AppShell Nav                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│              ┌──────────────┐                       │
│              │  ScoreCircle  │                       │
│              │     85%       │                       │
│              └──────────────┘                       │
│         "Great job! Keep it up! 🎯"                 │
│                                                     │
│    ┌────────┐  ┌────────┐  ┌────────┐               │
│    │  Time  │  │Accuracy│  │  Qs    │               │
│    │ --:--  │  │  85%   │  │  20    │               │
│    └────────┘  └────────┘  └────────┘               │
│                                                     │
│  Question Review                                    │
│  ┌──────────────────────────────────────────┐       │
│  │ 1. ✓ What is...              [expand ▼]  │       │
│  │ 2. ✗ Which of...             [expand ▼]  │       │
│  │ 3. ✓ True or false...        [expand ▼]  │       │
│  └──────────────────────────────────────────┘       │
│                                                     │
│  [← Dashboard]  [Try Again]  [Review Mistakes]      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Components:** Custom `ScoreCircle` (animated radial progress) · `card` [I] for stat satellites · Custom `ReviewList` with expandable rows (shows user answer, correct answer, explanation per question) · `button` [I] for actions

**Score-based messaging:**

| Score range | Message | Tone |
|-------------|---------|------|
| 90–100% | "Outstanding!" | Celebratory |
| 70–89% | "Great job! Keep it up!" | Encouraging |
| 50–69% | "Good effort! Room to grow." | Supportive |
| < 50% | "Keep practicing!" | Motivating, never punitive |

**Actions:**
- "Dashboard" → `/dashboard`
- "Try Again" → `/config?document_id=...` (same document, new config)
- "Review Mistakes" (shown when score < 100%) → scrolls to the question review section

> **Known limitation:** Time stat displays `--:--`. The backend does not track session duration (no start/end timestamps on `quiz_sessions`). Implementing real time tracking requires adding `started_at` and `completed_at` columns to the `quiz_sessions` table and recording timestamps on session create and last answer submission.

**Motion:** ScoreCircle: animated fill from 0% → final score over 1.5s with count-up (approved pattern). Stat satellites: stagger reveal. Review list: fade in after score animation completes.

---

## 8. Governance Decisions

### `/analytics` — Full Rebuild Required

**Current state:** Prototype route displaying basic document metadata (filename, file type, file size, chunk count). Does not show any actual analytics (no quiz history, no performance trends, no topic mastery).

**Issues:**
- Uses old design tokens (`indigo-dark`, `gray-*`, `border-gray-200`) — violates ui-lock §1.
- Does not use AppShell — inconsistent with all other protected routes.
- Custom header duplicates nav that AppShell already provides.
- Stat cards show document metadata, not learning analytics.
- No real analytics data exists in the backend — the `quiz_sessions` and `questions` tables would need to be queried for aggregate stats.

**Decision:** Do not iterate on the current implementation. When analytics becomes a priority:
1. Design from scratch using AppShell + v2 tokens.
2. Define backend endpoints for aggregate session data (scores over time, topic mastery, question type performance).
3. Use `chart` (@shadcn, TBD) with recharts for visualizations.
4. Follow the standard review gate: prototype in `/dev/blocks` → evaluate → approve → ship.

### `/feedback` — Delete

**Current state:** Static design mockup with fully hardcoded content. Not wired to any backend. Contains:
- A hardcoded question ("Which algorithm is best suited for image classification?")
- A hardcoded answer ("Convolutional Neural Networks (CNN)")
- A hardcoded `isCorrect: true` evaluation
- A hardcoded "+10 XP" badge (XP system does not exist)
- Uses old design tokens (`space-indigo`, `error-light`, `success-light`)

**Decision:** Delete this route. Its purpose (showing answer feedback) is already fully served by the `FeedbackPanel` within the `/session` route. The `/feedback` route was a design exploration that is no longer needed.

### `/dev/blocks` — Keep (Internal Only)

The design lab is an internal tool for evaluating registry components against project tokens. It is auth-gated but should never be linked from production UI. Keep as-is.

### Dashboard layout (`dashboard/layout.tsx`) — Remove

A `dashboard/layout.tsx` exists with a sidebar navigation pattern, but it is unused — the dashboard page uses AppShell directly. This file is dead code and should be deleted to avoid confusion.

---

## 9. Component Mapping Appendix

Per-route summary of shadcn primitives and approved blocks. Only references components from the [component-catalog.md](./component-catalog.md) shortlist and [ui-lock.md §4](./ui-lock.md) approved patterns.

**Legend:** [I] = Installed · [A] = Approved in ui-lock · TBD = Not yet approved (requires review gate)

### Landing Page

| Component | Source | Status | Usage |
|-----------|--------|--------|-------|
| accordion | @shadcn | [I] | FAQ section |
| badge | @shadcn | [I] | Feature tags, plan labels |
| card | @shadcn | [I] | Pricing cards, feature cards, testimonial cards |
| separator | @shadcn | [I] | Section dividers |
| star-rating | @shadcraft | [I] | Testimonial ratings |
| navigation-menu | @shadcn | TBD | Accessible top nav with dropdowns |
| carousel | @shadcn | TBD | Testimonial mobile slider |
| avatar-stack | @shadcraft | TBD | Testimonial user photos |

### Auth Pages

| Component | Source | Status | Usage |
|-----------|--------|--------|-------|
| input | @shadcn | [I] | Email, password fields |
| label | @shadcn | [I] | Form labels |
| button | @shadcn | [I] | Submit, social login |
| dialog | @shadcn | [I] | Password reset modal |
| form | @shadcn | TBD | react-hook-form + zod integration |
| input-otp | @shadcn | TBD | Email verification codes |

### Dashboard

| Component | Source | Status | Usage |
|-----------|--------|--------|-------|
| card | @shadcn | [I] | Stat cards, document cards, continue learning |
| badge | @shadcn | [I] | Document status (ready/processing/failed) |
| button | @shadcn | [I] | Upload CTA, Start Quiz, actions |
| dropdown-menu | @shadcn | [I] | Card action menus |
| dialog | @shadcn | [I] | Delete confirmation |
| tabs | @shadcn | [I] | View switching (future) |
| stat-cards-01 | @bundui | [I] [A] | Metrics grid with deltas |
| Scroll reveal | Custom (InView) | [A] | Section entrance animations |
| Hover lift | Custom | [A] | Card interaction feedback |
| Count-up | Custom (Framer) | [A] | Animated stat numbers |
| pagination | @shadcn | TBD | Document list pagination (at scale) |
| table | @shadcn | TBD | Document list view (at scale) |

### Upload

| Component | Source | Status | Usage |
|-----------|--------|--------|-------|
| button | @shadcn | [I] | Browse, retry |
| progress | @shadcn | [I] | Upload/processing progress |
| card | @shadcn | [I] | Tips section |

### Config

| Component | Source | Status | Usage |
|-----------|--------|--------|-------|
| stepper | @formcn | [I] [A] | 4-step flow indicator |
| button | @shadcn | [I] | Back, Continue, Start Quiz |
| checkbox | @shadcn | [I] | Question type multi-select |
| tooltip | @shadcn | [I] | Option explanations |

### Session

| Component | Source | Status | Usage |
|-----------|--------|--------|-------|
| progress | @shadcn | [I] | Question progress bar |
| button | @shadcn | [I] | Submit, Next Question |
| textarea | @shadcn | [I] | Free-text answer input |
| skeleton | @shadcn | [I] | QuestionCard loading state |
| tooltip | @shadcn | [I] | Hint hovers |
| radio-group | @shadcn | TBD | MCQ answer selection (replace custom OptionPill) |
| sheet | @shadcn | TBD | Side panel for hints/feedback |

### Results

| Component | Source | Status | Usage |
|-----------|--------|--------|-------|
| card | @shadcn | [I] | Stat satellite cards |
| button | @shadcn | [I] | Dashboard, Try Again, Review |
| accordion | @shadcn | [I] | Expandable question review |
| badge | @shadcn | [I] | Score label |
| Count-up | Custom (Framer) | [A] | Animated score counter |

### Settings

| Component | Source | Status | Usage |
|-----------|--------|--------|-------|
| card | @shadcn | [I] | Section containers |
| button | @shadcn | [I] | Password reset, avatar actions |
| avatar | @shadcn | [I] | Profile photo |
| badge | @shadcn | [I] | "Free Plan" label |
| dialog | @shadcn | [I] | Confirmation modals |
