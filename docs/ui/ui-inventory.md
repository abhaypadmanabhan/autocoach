# AutoCoach UI Inventory

| Field | Value |
|---|---|
| **Framework** | Next.js 16.1.6 (App Router), React 19.2.3, TypeScript 5 |
| **Current UI stack** | Tailwind CSS v4 + Framer Motion 12 + Lucide React + 100% hand-rolled components (no component library) |
| **State / data** | SWR 2.3 for server state, React Context for toasts, local `useState` everywhere else |
| **Auth** | Supabase Auth (JWT), middleware-protected routes |

**UI lock recommendation:**
Adopt shadcn/ui as the component primitive layer on top of the existing Tailwind v4 + Radix foundation. The codebase already uses Tailwind exclusively for styling and Framer Motion for animation, so shadcn slots in without removing either. The current hand-rolled components (buttons, modals, inputs, skeletons, toasts, dropdowns) should be migrated one-by-one to shadcn equivalents, keeping the existing CSS custom-property design tokens (brand-primary, surface-dark, etc.) and mapping them into the shadcn CSS variable contract. The landing page (`/`) uses a completely separate light-mode design system with "legacy" token names and can be migrated last or kept as-is behind a separate theme scope. Priority: lock the token file first, then replace the highest-reuse primitives (Button, Input, Dialog, Toast, Skeleton) before touching page layouts.

---

## 1. Framework + Routing

### Framework
- **Next.js 16.1.6** with App Router (`frontend/src/app/`)
- **React 19.2.3**, **TypeScript 5**
- Minimal `next.config.ts` (defaults only)

### Routing style
File-based App Router with route groups. No `pages/` directory.

### Routes detected

| Route | File | Auth |
|---|---|---|
| `/` | `app/page.tsx` | Public |
| `/login` | `app/(auth)/login/page.tsx` | Public (redirects if authed) |
| `/signup` | `app/(auth)/signup/page.tsx` | Public (redirects if authed) |
| `/dashboard` | `app/dashboard/page.tsx` | Protected |
| `/upload` | `app/upload/page.tsx` | Protected |
| `/config` | `app/config/page.tsx` | Protected |
| `/session` | `app/session/page.tsx` | Protected |
| `/results` | `app/results/page.tsx` | Protected |
| `/feedback` | `app/feedback/page.tsx` | Protected |
| `/analytics` | `app/analytics/page.tsx` | Protected |
| `/settings` | `app/settings/page.tsx` | Protected |

### Layouts
- `app/layout.tsx` -- Root. Loads Inter + Plus Jakarta Sans fonts, sets CSS variables `--font-inter` / `--font-jakarta`.
- `app/(auth)/layout.tsx` -- Split-screen auth layout (decorative left panel + form right).
- `app/dashboard/layout.tsx` -- unknown (not read, but `dashboard/page.tsx` wraps itself in `<AppShell>`).

### Middleware
`frontend/src/middleware.ts` -- Supabase SSR middleware. Protected paths: `/dashboard`, `/upload`, `/config`, `/session`, `/feedback`, `/results`, `/analytics`, `/settings`. Auth paths redirect logged-in users: `/login`, `/signup`.

---

## 2. Current Component Stack

### UI / component libraries
- **None installed.** All components are hand-rolled.
- No MUI, Chakra, Ant Design, Mantine, Headless UI, or shadcn.

### Icon library
- **lucide-react** `^0.563.0` -- used on every page.

### Animation
- **framer-motion** `^12.29.2` -- used on every page for transitions, spring physics, stagger animations, `AnimatePresence`.
- `frontend/src/lib/motions.ts` -- shared motion variant presets (page transitions, stagger containers, card lifts, step enter/exit).

### Form libraries
- **None.** All forms use raw `<form>` + `useState`. No react-hook-form, formik, or zod/yup.

### Validation
- **None (client-side).** Only native HTML `required`, `type`, `minLength`. Password strength is calculated inline in `signup/page.tsx`.

### State management
- **SWR** `^2.3.8` -- all data fetching (`useDocuments`, `useQuiz`, `useAvatar`).
- **React Context** -- toast notifications only (`ToastProvider`).
- No Redux, Zustand, Jotai, or Recoil.

### Table / chart / data-viz libraries
- **None.** Score display is a custom SVG circle (`ScoreCircle.tsx`). No charting library.

---

## 3. Styling System

### Tailwind CSS
- **Tailwind v4** (`tailwindcss ^4`, `@tailwindcss/postcss ^4`).
- No `tailwind.config.ts` file -- Tailwind v4 uses CSS-first configuration via `@theme inline` in `globals.css`.
- PostCSS config at `frontend/postcss.config.mjs`:
  ```js
  { plugins: { "@tailwindcss/postcss": {} } }
  ```

### Global styles entrypoint
`frontend/src/app/globals.css` (~958 lines). Contains:

1. **CSS custom properties** (`:root` block) -- two generations of tokens:
   - **Design System v2** (dark-mode-first): `--brand-primary`, `--surface-dark`, `--text-primary`, etc.
   - **Legacy tokens** (light-mode landing page): `--primary`, `--indigo-space`, `--background-light`, `--slate-border`, etc.
2. **`@theme inline`** block that maps CSS vars into Tailwind utility classes (e.g., `--color-brand-primary: var(--brand-primary)`).
3. **Typography utility classes**: `.text-hero`, `.text-h1`, `.text-h2`, `.text-body`, `.text-small`, `.text-micro`, `.text-numeral`.
4. **30+ `@keyframes` animations** and corresponding utility classes.
5. **Component pattern CSS**: `.pill-btn`, `.diamond-btn`, `.glass`, `.card-glow-border`, `.testimonial-card`, `.accordion-content`, `.demo-window`, etc.
6. **Layout utilities**: `.container-main`, `.section-padding`, `.section-gap`.

### Theming approach
CSS custom properties (`:root`) surfaced to Tailwind via `@theme inline`. No runtime theme switching. The app is dark-mode by default for authenticated routes; the landing page uses a separate light-mode palette via the legacy tokens.

### Design tokens inventory

**Brand colors:**
| Token | Value | Used where |
|---|---|---|
| `--brand-primary` | `#cd776a` (Dusty Rose) | Buttons, accents, CTAs |
| `--brand-secondary` | `#c18c5d` (Toasted Almond) | Secondary accents, gradients |

**Surface colors (dark theme):**
| Token | Value | Role |
|---|---|---|
| `--surface-dark` | `#34344a` | Main background |
| `--surface-darker` | `#2a2a3e` | Bottom bars |
| `--surface-card` | `#3a3a52` | Card/elevated surface |
| `--surface-border` | `#495867` | Borders |

**Semantic colors:**
| Token | Value |
|---|---|
| `--semantic-success` | `#22c55e` |
| `--semantic-error` | `#ef4444` |
| `--semantic-warning` | `#eab308` |

**Text colors:**
| Token | Value |
|---|---|
| `--text-primary` | `#f2f5de` (cream) |
| `--text-secondary` | `rgba(242,245,222,0.7)` |
| `--text-muted` | `rgba(242,245,222,0.5)` |

**Legacy tokens (landing page only):**
`--primary`, `--primary-dark`, `--indigo-space`, `--background-light`, `--slate-border`, `--slate-text`, `--success`, `--error`, plus 10 more. These duplicate the v2 tokens under different names.

**Typography:**
| Stack | CSS Variable | Usage |
|---|---|---|
| Sans (body) | `--font-inter` (Inter) | Default body text |
| Heading | `--font-jakarta` (Plus Jakarta Sans) | `.font-heading` |
| Serif (display) | Playfair Display (hardcoded) | `.font-serif` -- used on protected pages |

No CSS modules. No styled-components. No Emotion. All styling is Tailwind utilities + globals.css classes.

---

## 4. shadcn/ui Readiness Snapshot

| Check | Status |
|---|---|
| `components.json` exists | No |
| `src/components/ui/` directory | Yes -- but contains hand-rolled components, not shadcn |
| `lib/utils.ts` with `cn()` | No -- no `cn()` helper anywhere |
| Radix primitives installed | No |
| Class Variance Authority (cva) | No |
| `clsx` / `tailwind-merge` | No |

**Assessment:** shadcn is not initialized. The file structure (`components/ui/`) matches shadcn conventions by coincidence. Adding shadcn requires:
1. `npx shadcn@latest init` (creates `components.json`, installs `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/*`).
2. Mapping the existing CSS vars (`--brand-primary`, `--surface-*`, `--text-*`) into shadcn's expected `--primary`, `--background`, `--foreground`, `--card`, `--border`, `--muted`, etc.
3. Renaming or namespacing the existing `components/ui/` files to avoid collisions with shadcn's output directory.

---

## 5. Page-by-Page UI Inventory

### 5.1 Landing Page (`/`)
**File:** `app/page.tsx` (1487 lines -- monolithic)
**Purpose:** Marketing / conversion page for unauthenticated visitors.

**Sections:**
| Section | UI Pattern | Notes |
|---|---|---|
| Navigation | Sticky glass nav, mobile drawer | `glass-nav` CSS class, scroll-responsive |
| Hero | 2-column grid, CTA buttons, trust indicators, mock app preview | Uses `demo-window` CSS pattern |
| Features | 6 feature cards in 3-col grid | `card-glow-border` hover effect |
| How It Works | 3-step horizontal stepper with connecting line | Desktop-only connecting line |
| Demo | Animated 5-stage interactive demo | `AnimatePresence` stage cycling |
| Testimonials | 4 cards in responsive grid | `testimonial-card` CSS class |
| Pricing | 2-plan comparison with monthly/yearly toggle | Custom toggle, `pricing-popular` variant |
| FAQ | 6 accordion items | CSS `grid-template-rows` accordion |
| CTA | Centered CTA with gradient background | Floating shapes |
| Footer | 5-column footer with newsletter form | Social icons (lucide) |

**Components used:** All inline (no imports from `components/`). 10 local function components: `Navigation`, `HeroSection`, `FeaturesSection`, `HowItWorksSection`, `DemoSection`, `TestimonialsSection`, `PricingSection`, `FAQSection`, `FinalCTASection`, `Footer`.

**Known issues:**
- Uses **legacy light-mode token names** (`text-indigo-space`, `bg-primary`, `border-slate-border`, `bg-background-light`, `text-slate-text`) that are completely separate from the v2 dark-mode tokens used on protected pages.
- 1487-line monolith -- not split into separate component files.
- Google/Apple SVG icon components are duplicated between login and signup.
- Newsletter form has no `action` or submit handler.
- All `#` links in footer (Blog, Docs, Tutorials, About, Contact, Careers, Privacy, Terms, Cookie) are dead.

**Refactor opportunity:** Extract each section into a separate component file under `components/landing/`. Unify token names with the v2 system.

---

### 5.2 Login (`/login`)
**File:** `app/(auth)/login/page.tsx` (301 lines)
**Layout:** `app/(auth)/layout.tsx` -- split-screen (decorative left, form right)
**Purpose:** Email/password sign-in.

**UI sections:**
- Social login buttons (Google, Apple) -- **placeholder only**, not implemented.
- Divider ("or continue with email").
- Email + password fields with icons (Mail, Lock from lucide).
- Show/hide password toggle.
- Error banner (animated).
- Submit button with loading spinner.
- "Create account" link.

**Components used:** No imports from `components/`. All inline. Custom `GoogleIcon` and `AppleIcon` SVG components defined locally.

**Known issues:**
- Uses legacy light-mode tokens (`text-indigo-space`, `border-slate-border`, `bg-background-light`).
- Social login is fake -- `setTimeout` + error message.
- `GoogleIcon` and `AppleIcon` are duplicated in `signup/page.tsx`.

**Refactor opportunity:** Extract social buttons + icons into shared components. Unify form inputs as a reusable component with label, icon, error state.

---

### 5.3 Signup (`/signup`)
**File:** `app/(auth)/signup/page.tsx` (509 lines)
**Layout:** Same auth layout.
**Purpose:** Account registration.

**UI sections:**
- Same social buttons as login (duplicated code).
- Name, email, password fields.
- Password strength meter (bar + checklist).
- Custom checkbox for terms agreement.
- Success state (check email confirmation).

**Components used:** All inline. `GoogleIcon`, `AppleIcon` duplicated from login.

**Known issues:**
- Duplicated social login UI and SVG icons.
- `getPasswordStrength()` is defined inline; could be a shared util.
- Terms and Privacy links are `#` (dead).

**Refactor opportunity:** Share form inputs and social buttons with login. Extract password strength into `lib/`.

---

### 5.4 Dashboard (`/dashboard`)
**File:** `app/dashboard/page.tsx` (507 lines)
**Purpose:** Document list, stats overview, continue learning.

**UI sections:**
- Hero header with greeting + "Study New" CTA.
- 3-column stat cards (Documents, Ready, Processing).
- Document grid (responsive 1-3 columns).
- Empty state with animated illustration.
- "Continue Learning" card for most recent ready document.
- Delete confirmation modal.

**Components used:**
- `AppShell`, `PageContainer`, `Section` from `components/layout/AppShell`
- `StatusBadge`, `ProgressBar` from `components/ui/StatusBadge`
- `DocumentCardSkeleton`, `StatCardSkeleton`, `ErrorBanner` from `components/ui/Skeleton`
- `ConfirmModal` from `components/ui/ConfirmModal`
- Motion variants from `lib/motions`
- Local: `DocumentCard`, `EmptyState`

**Known issues:**
- `DocumentCard` is defined inline in the page file (153 lines) -- should be its own component.
- `logout-button.tsx` exists in `dashboard/` but is not imported on this page (logout is in `AvatarDropdown`).

**Refactor opportunity:** Move `DocumentCard` and `EmptyState` to `components/dashboard/`.

---

### 5.5 Upload (`/upload`)
**File:** `app/upload/page.tsx` (347 lines)
**Purpose:** Drag-and-drop file upload with processing status.

**UI sections:**
- Header ("What do you want to study?").
- Dashed-border drop zone with animated cloud icon.
- Upload progress: spinner -> processing -> success/failure states.
- 3-column tips grid.

**Components used:**
- `AppShell`, `PageContainer` from `components/layout/AppShell`
- `ErrorBanner` from `components/ui/Skeleton`
- `DiamondSpinner` from `components/ui/DiamondButton`
- `ProgressDots`, `ProgressBar` from `components/ui/StatusBadge`

**Known issues:**
- Hardcoded emoji icons in tips section (not lucide icons, inconsistent with rest of app).
- Progress bar shows hardcoded `60` during processing (`progress={60}`).

**Refactor opportunity:** Replace hardcoded emojis with lucide icons. Make progress bar reflect real processing progress.

---

### 5.6 Config (`/config`)
**File:** `app/config/page.tsx` (479 lines)
**Purpose:** Multi-step quiz configuration (question count, difficulty, types, timer).

**UI sections:**
- 2-column layout: stepper sidebar (left) + step content (right).
- 4 steps with `AnimatePresence` transitions.
- `OptionPill` selections for counts, types, timer.
- `DifficultyCard` for difficulty selection.
- Step navigation (back/continue/start).

**Components used:**
- `AppShell`, `PageContainer` from `components/layout/AppShell`
- `ErrorBanner`, `Skeleton` from `components/ui/Skeleton`
- `SetupStepper`, `StepContent` from `components/quiz/SetupStepper`
- `OptionPill`, `DifficultyCard`, `OptionPillGrid` from `components/ui/OptionPill`
- `DiamondButton` from `components/ui/DiamondButton`

**Known issues:**
- Custom number input (3-50) lacks validation feedback.
- No way to go back to document selection from this page without using browser back.

**Refactor opportunity:** Minor. Page is well-structured with reusable components.

---

### 5.7 Session (`/session`)
**File:** `app/session/page.tsx` (447 lines)
**Purpose:** Active quiz-taking experience.

**UI sections:**
- Progress header (question X of Y, correct count, timer).
- Question card with type-specific rendering (MCQ, T/F, Free Text).
- Submit button.
- Feedback panel (slide-up bottom sheet).
- Time's up overlay (full-screen modal).

**Components used:**
- `AppShell`, `PageContainer` from `components/layout/AppShell`
- `QuestionCardSkeleton`, `ErrorBanner` from `components/ui/Skeleton`
- `QuestionCard` from `components/quiz/QuestionCard`
- `TimerBar` from `components/quiz/TimerBar`
- `FeedbackPanel` from `components/quiz/FeedbackPanel`
- `ProgressBar` from `components/ui/StatusBadge`

**Known issues:**
- Timer logic uses `sessionStorage` for persistence across refreshes -- works but not the cleanest pattern.
- Progress bar is duplicated (custom inline one + imported `ProgressBar` from StatusBadge).

**Refactor opportunity:** Consolidate progress bar implementations. Timer state management could be a custom hook.

---

### 5.8 Results (`/results`)
**File:** `app/results/page.tsx` (336 lines)
**Purpose:** Post-quiz score display and question review.

**UI sections:**
- Hero score section with animated `ScoreCircle` (SVG), performance badge, score breakdown grid.
- 3 satellite stats (Time, Accuracy, Questions).
- Expandable question review list.
- Sticky action buttons (Dashboard, Try Again, Review).

**Components used:**
- `AppShell`, `PageContainer`, `Section` from `components/layout/AppShell`
- `Skeleton` from `components/ui/Skeleton`
- `ScoreCircle`, `ScoreBreakdown`, `StatSatellite` from `components/results/ScoreCircle`
- `ReviewList` from `components/results/ReviewRow`

**Known issues:**
- Time stat hardcoded to `"--:--"` (time tracking not implemented on results).
- `toSafeNumber` utility defined inline; belongs in `lib/`.

**Refactor opportunity:** Implement actual time tracking. Move utility to `lib/`.

---

### 5.9 Feedback (`/feedback`)
**File:** `app/feedback/page.tsx` (156 lines)
**Purpose:** Static mock feedback screen (appears to be a design prototype, not connected to the quiz flow).

**UI sections:**
- Custom header (not using `AppShell`).
- Hardcoded question with correct answer.
- Feedback area with XP badge.
- "Next Question" button links to `/results`.

**Components used:** None from `components/`. All inline. Uses `dark:` variant classes.

**Known issues:**
- **Not integrated with quiz flow** -- hardcoded content, no dynamic data.
- Uses its own header (not `AppShell`), inconsistent with other pages.
- Uses `dark:` Tailwind variants that aren't set up elsewhere (html has `class="light"`).
- References `bg-success-light/30` which may not resolve correctly.

**Refactor opportunity:** Either remove this page (the real feedback is `FeedbackPanel` in session) or integrate it into the session flow. Currently dead/orphaned UI.

---

### 5.10 Analytics (`/analytics`)
**File:** `app/analytics/page.tsx` (147 lines)
**Purpose:** Document detail view with metadata stats.

**UI sections:**
- Custom light-mode header (not using `AppShell`).
- Document info header with status badge.
- 4-column stat cards (Status, File Type, File Size, Chunks).
- Document information detail section.

**Components used:** None from `components/`. All inline. Uses completely different styling from the rest of the app.

**Known issues:**
- **Uses light-mode styling** (`bg-white`, `border-gray-200`, `text-indigo-dark`) -- completely inconsistent with the dark-mode design system used on dashboard/session/results/settings.
- Custom header instead of `AppShell`.
- Uses `BookOpen` for logo instead of `School` (inconsistent branding).
- Stat card colors use Tailwind defaults (`bg-indigo-50`, `bg-yellow-50`, etc.) instead of design tokens.
- No actual analytics data -- just shows document metadata.

**Refactor opportunity:** Rebuild using `AppShell` and the v2 dark-mode token system. Add real analytics (quiz history, score trends).

---

### 5.11 Settings (`/settings`)
**File:** `app/settings/page.tsx` (271 lines)
**Purpose:** User profile, security, subscription management.

**UI sections:**
- Profile section: avatar upload/delete, email display.
- Security section: password reset via email.
- Subscription section: "Free Plan" with disabled upgrade button.

**Components used:**
- `AppShell`, `PageContainer` from `components/layout/AppShell`
- `useAvatar` hook
- `useToast` hook

**Known issues:**
- Avatar uses `next/image` `<Image>` without configuring remote image domains (may 404 in production).
- Subscription section is placeholder -- no billing integration.

**Refactor opportunity:** Minor. Well-structured page using the v2 design system.

---

## 6. Reusable Components Inventory

### Layout

| Component | File | Used by | Notes |
|---|---|---|---|
| `AppShell` | `components/layout/AppShell.tsx` | Dashboard, Upload, Config, Session, Results, Settings | Main app wrapper. Sticky nav, decorative circle, page transitions, toast provider. |
| `PageContainer` | `components/layout/AppShell.tsx` | Same as above | Responsive width container (sm/md/lg/xl/full). |
| `Section` | `components/layout/AppShell.tsx` | Dashboard, Results | Vertical spacing wrapper (sm/md/lg). |

### UI Primitives

| Component | File | Used by | Duplicates? |
|---|---|---|---|
| `AvatarDropdown` | `components/ui/AvatarDropdown.tsx` | `AppShell` | No. Click-outside + escape handling built in. |
| `ConfirmModal` | `components/ui/ConfirmModal.tsx` | Dashboard | No. Supports `danger` variant + loading state. |
| `DiamondButton` | `components/ui/DiamondButton.tsx` | Config | No. Also exports `DiamondSpinner` (used in Upload) and `DiamondMarker`. |
| `ErrorCard` | `components/ui/ErrorCard.tsx` | Unknown (checked: not imported on any page) | **Unused.** May be dead code. |
| `LoadingOverlay` | `components/ui/LoadingOverlay.tsx` | Unknown (checked: not imported on any page) | **Unused.** Rotating diamond + study tips. |
| `OptionPill` | `components/ui/OptionPill.tsx` | Config | No. Also exports `OptionPillGrid` and `DifficultyCard`. |
| `Skeleton` | `components/ui/Skeleton.tsx` | Dashboard, Config, Results | Also exports `DocumentCardSkeleton`, `QuestionCardSkeleton`, `StatCardSkeleton`, `ErrorBanner`. |
| `StatusBadge` | `components/ui/StatusBadge.tsx` | Dashboard, Upload, Session | Also exports `ProcessingIndicator`, `ProgressDots`, `ProgressBar`. |
| `Toast` | `components/ui/Toast.tsx` | `AppShell` (via `ToastProvider`) | No. Auto-dismiss 3s. |

### Quiz Components

| Component | File | Used by |
|---|---|---|
| `QuestionCard` | `components/quiz/QuestionCard.tsx` | Session |
| `FeedbackPanel` | `components/quiz/FeedbackPanel.tsx` | Session |
| `SetupStepper` + `StepContent` | `components/quiz/SetupStepper.tsx` | Config |
| `TimerBar` + `TimerCircle` + `Countdown` | `components/quiz/TimerBar.tsx` | Session (imported but `TimerBar` not directly rendered -- timer is inline) |
| `VoiceRecorder` | `components/quiz/VoiceRecorder.tsx` | Unknown (not imported on any page currently) |

### Results Components

| Component | File | Used by |
|---|---|---|
| `ScoreCircle` + `StatSatellite` + `ScoreBreakdown` | `components/results/ScoreCircle.tsx` | Results |
| `ReviewRow` + `ReviewList` + `ReviewSummary` | `components/results/ReviewRow.tsx` | Results |

### Hooks

| Hook | File | Purpose |
|---|---|---|
| `useQuiz` (4 hooks) | `hooks/useQuiz.ts` | `useSession`, `useCurrentQuestion`, `useCreateSession`, `useSubmitAnswer` |
| `useDocuments` (4 hooks) | `hooks/useDocuments.ts` | `useDocuments`, `useDocument`, `usePollDocumentStatus`, `useDeleteDocument` |
| `useUploadDocument` | `hooks/useUploadDocument.ts` | File upload with progress tracking |
| `useAvatar` | `hooks/useAvatar.ts` | Avatar upload/delete/refresh |
| `useToast` | `hooks/useToast.ts` | Toast context consumer |

### Potentially dead components
- `ErrorCard` (`components/ui/ErrorCard.tsx`) -- not imported anywhere.
- `LoadingOverlay` (`components/ui/LoadingOverlay.tsx`) -- not imported anywhere.
- `VoiceRecorder` (`components/quiz/VoiceRecorder.tsx`) -- not imported anywhere.
- `TimerBar` -- imported in session but the timer display is implemented inline instead.
- `dashboard/logout-button.tsx` -- exists but not imported (logout handled by `AvatarDropdown`).

---

## 7. Recommendations

### Standardize on
- **shadcn/ui + Tailwind v4 + Radix primitives** for all interactive components.
- **Lucide React** (already in use) as the sole icon library.
- **Framer Motion** (already in use) for animations -- shadcn components should be wrapped with motion when needed.
- **SWR** (already in use) for server state.

### Token unification (critical first step)
1. **Merge the two token systems.** The v2 tokens (`--brand-primary`, `--surface-*`, `--text-*`) and legacy tokens (`--primary`, `--indigo-space`, `--slate-border`, etc.) must collapse into one set. The landing page should adopt the v2 token names.
2. **Map tokens to shadcn's expected CSS variables** (`--primary`, `--secondary`, `--background`, `--foreground`, `--card`, `--border`, `--muted`, `--accent`, `--destructive`, `--ring`, `--input`). This is required for shadcn components to pick up the design system automatically.

### Components to replace with shadcn
| Current | Replace with |
|---|---|
| `ConfirmModal` | `AlertDialog` |
| `Toast` + `ToastProvider` | `Sonner` (shadcn's toast) or shadcn `Toast` |
| `AvatarDropdown` | `DropdownMenu` + `Avatar` |
| `Skeleton` / `DocumentCardSkeleton` etc. | `Skeleton` |
| `OptionPill` (radio-style) | `ToggleGroup` or `RadioGroup` |
| `StatusBadge` | `Badge` |
| `ProgressBar` | `Progress` |
| Inline `<input>` fields | `Input` + `Label` |
| Inline `<button>` elements | `Button` (with `cva` variants) |
| Accordion (FAQ, ReviewRow) | `Accordion` |
| Custom checkbox (signup terms) | `Checkbox` |

### What to remove
- **Duplicated SVG icons** (`GoogleIcon`, `AppleIcon`) in login and signup -- extract to `components/icons/`.
- **Dead components:** `ErrorCard`, `LoadingOverlay`, `VoiceRecorder`, `dashboard/logout-button.tsx` -- confirm unused and delete.
- **Legacy CSS utility classes** (`.pill-btn`, `.diamond-btn`, `.card-glow-border`, etc.) -- migrate to component-level Tailwind + cva variants.
- **Orphaned pages:** `/feedback` (static mock, not connected to quiz flow) -- remove or integrate.

### What to add
- `cn()` utility (`clsx` + `tailwind-merge`) in `lib/utils.ts` -- required for shadcn and good practice.
- **Form library** (`react-hook-form` + `zod`) for login, signup, and config pages -- eliminates ad-hoc validation and `useState` sprawl.
- `components.json` (shadcn config) pointing to `src/components/ui` with the project's path aliases.

### Risks
1. **Landing page divergence.** The landing page uses an entirely separate visual language (light-mode, legacy tokens, inline component definitions). Migrating it to the v2 token system + shadcn requires visual QA for every section.
2. **Tailwind v4 compatibility.** shadcn's default templates assume Tailwind v3 config. Tailwind v4's CSS-first `@theme inline` approach requires manual mapping during `shadcn init`.
3. **Accessibility gaps.** Current custom components (modal, dropdown, accordion, toggle) lack ARIA attributes, keyboard navigation, and focus management. shadcn/Radix solves this automatically.
4. **`components/ui/` collision.** shadcn outputs to `components/ui/` by default. The existing hand-rolled components in that directory must be renamed/moved before initialization to avoid overwrites.
5. **No `cn()` utility.** Every component that conditionally applies classes uses template literals or ternaries. Migrating to `cn()` is mechanical but touches many files.
