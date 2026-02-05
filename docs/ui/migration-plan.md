# AutoCoach UI Migration Plan

> Companion to `ui-inventory.md` (current state) and `ui-lock.md` (target rules).
> **Goal:** Replace hand-rolled primitives with shadcn/ui without redesigning pages.

---

## 0. Pre-Migration State (discovered during audit)

shadcn is **partially initialized**. The inventory doc predates these additions:

| Item | Status |
|---|---|
| `components.json` | Exists. Style: `new-york`, registries configured (`@bundui`, `@shadcraft`, `@formcn`, `@animbits`). |
| `lib/utils.ts` (`cn()`) | **MISSING.** The 3 installed shadcn components import it but it doesn't exist -- they will error at runtime. |
| `clsx` / `tailwind-merge` | **NOT in package.json.** Must be installed before anything works. |
| `class-variance-authority` | Installed (`^0.7.1`). |
| `@radix-ui/react-slot` | Installed (`^1.2.4`). |
| `@radix-ui/react-avatar` | Installed (`^1.1.11`). |
| `tw-animate-css` | Installed as devDep (`^1.4.0`) -- shadcn animation utility. |

### Already-installed shadcn components (not yet used by any page)

| File | Type | Imported by |
|---|---|---|
| `components/ui/button.tsx` | shadcn `Button` | Nothing. Unused. |
| `components/ui/avatar.tsx` | shadcn `Avatar` | `components/avatar-with-status-indicator.tsx` only (itself unused). |
| `components/ui/star-rating.tsx` | shadcn `StarRating` | Nothing. Unused. |

### Additional orphan

| File | Notes |
|---|---|
| `components/avatar-with-status-indicator.tsx` | Imports shadcn `Avatar`. Not imported by any page. Demo/prototype leftover. |

### Blocker before any migration step

1. **Create `src/lib/utils.ts`** with the `cn()` export (`clsx` + `tailwind-merge`).
2. **Install missing deps:** `npm i clsx tailwind-merge`.
3. Verify `button.tsx`, `avatar.tsx`, `star-rating.tsx` compile without errors.

---

## 1. Top 10 Primitives to Standardize

Listed in recommended migration order (least risky / most reused first).

---

### P1. Button

| | |
|---|---|
| **shadcn component** | `Button` (`components/ui/button.tsx`) |
| **Current state** | Already installed but **unused**. Every page uses inline `<button>` or `<motion.button>` with ad-hoc Tailwind classes. No shared button component exists. |
| **Inline buttons found in** | Login, Signup, Dashboard (6+), Upload, Config (3), Session (3), Results (3), Feedback, Analytics, Settings (3) |
| **Migration** | Import shadcn `Button` and add AutoCoach-specific variants (`brand`, `ghost-dark`, `pill`) via cva. Wrap with `motion` where hover/tap animation is needed. Replace inline buttons page-by-page. |
| **Order** | **1st** -- zero breakage risk, highest reuse count. |

---

### P2. Input

| | |
|---|---|
| **shadcn component** | `Input` + `Label` (to be installed) |
| **Current state** | Raw `<input>` elements with inline Tailwind in Login (2), Signup (3), Config (1 custom number), Settings (1 file input), Landing footer (1 email). Each duplicates focus ring, border, and padding styles. |
| **Pages impacted** | Login, Signup, Config, Settings, Landing (footer) |
| **Migration** | Install shadcn `Input` + `Label`. Create a composed `FormField` wrapper (icon slot + label + error). Replace inline inputs. |
| **Order** | **2nd** -- scoped to auth + config pages, high duplication. |

---

### P3. Skeleton

| | |
|---|---|
| **shadcn component** | `Skeleton` (to be installed) |
| **Current custom** | `components/ui/Skeleton.tsx` -- exports `Skeleton`, `DocumentCardSkeleton`, `QuestionCardSkeleton`, `StatCardSkeleton`, `ErrorBanner`. |
| **Pages impacted** | Dashboard, Config, Results, Session (via `QuestionCardSkeleton`) |
| **Collision** | shadcn will output `components/ui/skeleton.tsx` (lowercase). The existing file is `Skeleton.tsx` (uppercase). On case-insensitive filesystems (macOS default) this is a **direct collision**. |
| **Migration** | Rename existing file to `components/features/dashboard/Skeletons.tsx` (the compound skeletons are feature-specific). Move `ErrorBanner` to `components/features/shared/ErrorBanner.tsx`. Then install shadcn `Skeleton` as the base primitive. Rewrite compound skeletons to compose the shadcn `Skeleton`. |
| **Order** | **3rd** -- must resolve the filename collision early. |

---

### P4. Dialog / AlertDialog

| | |
|---|---|
| **shadcn component** | `AlertDialog` (to be installed) |
| **Current custom** | `components/ui/ConfirmModal.tsx` -- supports `danger` variant + loading state. No ARIA roles, no keyboard trap, no focus management. |
| **Pages impacted** | Dashboard (delete confirmation) |
| **Migration** | Install shadcn `AlertDialog`. Build a thin `ConfirmDialog` wrapper that preserves the `danger` variant + loading prop. Swap the import in `dashboard/page.tsx`. Delete `ConfirmModal.tsx`. |
| **Order** | **4th** -- single consumer, accessibility win. |

---

### P5. DropdownMenu + Avatar

| | |
|---|---|
| **shadcn component** | `DropdownMenu` (to be installed) + existing `Avatar` |
| **Current custom** | `components/ui/AvatarDropdown.tsx` -- hand-rolled dropdown with click-outside and escape handling. Uses `next/image` for avatar, manual open/close state. |
| **Pages impacted** | Every authenticated page (via `AppShell`) |
| **Migration** | Install shadcn `DropdownMenu`. Rewrite `AvatarDropdown` to compose `DropdownMenu` + shadcn `Avatar` (already installed). Gains keyboard nav, ARIA menu roles, focus trap for free. |
| **Order** | **5th** -- touches `AppShell` which is on every page, but the change is isolated to one component file. |

---

### P6. Toast / Sonner

| | |
|---|---|
| **shadcn component** | `Sonner` (shadcn's recommended toast, to be installed) |
| **Current custom** | `components/ui/Toast.tsx` + `hooks/useToast.ts` -- React Context provider, auto-dismiss 3s, success/error/warning types. |
| **Pages impacted** | Every authenticated page (via `ToastProvider` in `AppShell`). Callers: Dashboard, Settings, Upload (indirectly). |
| **Migration** | Install `sonner` + shadcn `Sonner` wrapper. Replace `ToastProvider` in `AppShell` with `<Toaster />`. Replace `showToast("msg", "type")` calls with `toast.success("msg")` / `toast.error("msg")`. Delete `Toast.tsx` and `useToast.ts`. |
| **Order** | **6th** -- global change but mechanical find-and-replace for the 5 call sites. |

---

### P7. Badge

| | |
|---|---|
| **shadcn component** | `Badge` (to be installed) |
| **Current custom** | `components/ui/StatusBadge.tsx` -- exports `StatusBadge` (pending/processing/ready/error variants with colored dot + pulse), `ProcessingIndicator`, `ProgressDots`. |
| **Pages impacted** | Dashboard (`StatusBadge` on each document card), Upload (`ProgressDots`), Session (`ProgressBar` export) |
| **Migration** | Install shadcn `Badge`. Create `StatusBadge` as a composed component using shadcn `Badge` + cva for status-specific colors. Keep `ProgressDots` and `ProcessingIndicator` as separate small components (these are animation-specific, not badge-like). |
| **Order** | **7th** -- moderate reuse, straightforward mapping. |

---

### P8. Progress

| | |
|---|---|
| **shadcn component** | `Progress` (to be installed) |
| **Current custom** | `ProgressBar` exported from `components/ui/StatusBadge.tsx`. Also an **inline progress bar** in `session/page.tsx:295-302` (raw `<motion.div>` with `bg-brand-primary`). A third instance exists in `upload/page.tsx` using the `ProgressBar` import. |
| **Pages impacted** | Dashboard, Upload, Session |
| **Duplication** | 2 implementations: the `ProgressBar` component and the inline `<motion.div>` bar in session. |
| **Migration** | Install shadcn `Progress`. Replace both the component and the inline version. Remove `ProgressBar` export from `StatusBadge.tsx`. |
| **Order** | **8th** -- eliminates duplication. |

---

### P9. Accordion

| | |
|---|---|
| **shadcn component** | `Accordion` (to be installed) |
| **Current custom** | Two separate implementations: (a) CSS `grid-template-rows` accordion in landing page FAQ, (b) expand/collapse in `components/results/ReviewRow.tsx` using `useState` toggle. Neither has ARIA. |
| **Pages impacted** | Landing page (FAQ section), Results (question review) |
| **Migration** | Install shadcn `Accordion`. Replace the `ReviewList` accordion behavior in `ReviewRow.tsx`. Landing page FAQ replacement deferred to Phase C. |
| **Order** | **9th** -- Results page first; landing page last. |

---

### P10. Checkbox

| | |
|---|---|
| **shadcn component** | `Checkbox` (to be installed) |
| **Current custom** | Hand-rolled in `signup/page.tsx` -- a `<button>` styled as a checkbox with conditional border/bg and a `Check` lucide icon inside. No ARIA `role="checkbox"`, no `aria-checked`. |
| **Pages impacted** | Signup only |
| **Migration** | Install shadcn `Checkbox`. Replace the inline checkbox. Wire to react-hook-form when the signup form is migrated (Phase B). |
| **Order** | **10th** -- single use, low blast radius. |

---

## 2. Collisions & Cleanups

### 2.1 `components/ui/` filename collisions

shadcn outputs lowercase filenames. The existing hand-rolled files use PascalCase. On macOS (case-insensitive by default), `Skeleton.tsx` and `skeleton.tsx` collide.

| Existing file | Collides with shadcn | Resolution |
|---|---|---|
| `Skeleton.tsx` | `skeleton.tsx` | Rename to `features/shared/Skeletons.tsx` before installing shadcn Skeleton. |
| `Toast.tsx` | `sonner.tsx` (no collision) | Delete after Sonner migration. |
| `button.tsx` | Already IS the shadcn Button | No action -- it's the real thing. |
| `avatar.tsx` | Already IS the shadcn Avatar | No action. |

All other existing files (`AvatarDropdown.tsx`, `ConfirmModal.tsx`, `DiamondButton.tsx`, `ErrorCard.tsx`, `LoadingOverlay.tsx`, `OptionPill.tsx`, `StatusBadge.tsx`, `star-rating.tsx`) have no shadcn name collision.

### 2.2 Dead components to delete

| File | Reason |
|---|---|
| `components/ui/ErrorCard.tsx` | Not imported anywhere. |
| `components/ui/LoadingOverlay.tsx` | Not imported anywhere. |
| `components/quiz/VoiceRecorder.tsx` | Not imported anywhere. |
| `app/dashboard/logout-button.tsx` | Superseded by `AvatarDropdown` logout. |
| `components/avatar-with-status-indicator.tsx` | Demo/prototype block, not imported by any page. |

### 2.3 Duplicate progress bars

| Location | Type |
|---|---|
| `components/ui/StatusBadge.tsx` `ProgressBar` export | Reusable component, used in Dashboard + Upload |
| `app/session/page.tsx` line 295-302 | Inline `<motion.div>` bar |
| `app/upload/page.tsx` line 283-288 | Uses `ProgressBar` from StatusBadge |

**Resolution:** All three collapse into shadcn `Progress` with a motion wrapper.

### 2.4 Duplicate SVG icons

`GoogleIcon` and `AppleIcon` are defined identically in both `login/page.tsx` and `signup/page.tsx`.

**Resolution:** Extract to `components/icons/GoogleIcon.tsx` and `components/icons/AppleIcon.tsx` during Phase B auth form migration.

### 2.5 Legacy CSS classes in `globals.css`

These classes will become unused as components migrate to shadcn:

`.pill-btn`, `.diamond-btn`, `.card-glow-border`, `.testimonial-card`, `.demo-window`, `.demo-window-header`, `.demo-window-dot`, `.nav-link`, `.glass-nav`, `.accordion-content`, `.feature-icon`, `.stage-dot`, `.mobile-menu-overlay`, `.mobile-menu-panel`, `.btn-gradient-border`, `.section-padding`, `.section-gap`, `.container-main`.

**Resolution:** Do not delete during Phases A/B. Audit and remove in Phase C when the landing page is rebuilt.

### 2.6 Broken shadcn plumbing

| Issue | Fix |
|---|---|
| `lib/utils.ts` missing | Create with `cn()` export (clsx + tailwind-merge) |
| `clsx` not in package.json | `npm i clsx tailwind-merge` |
| `tailwind-merge` not in package.json | (same command) |
| Installed shadcn components (`button`, `avatar`, `star-rating`) reference missing `cn()` | Fixed once `lib/utils.ts` exists |

---

## 3. Safe Rollout Plan

### Phase 0: Foundation (do first, blocks everything)

| Step | Action | Files touched |
|---|---|---|
| 0.1 | `npm i clsx tailwind-merge` | `package.json` |
| 0.2 | Create `src/lib/utils.ts` with `cn()` | New file |
| 0.3 | Verify `button.tsx`, `avatar.tsx`, `star-rating.tsx` compile | None (just build check) |
| 0.4 | Delete dead components: `ErrorCard.tsx`, `LoadingOverlay.tsx`, `VoiceRecorder.tsx`, `logout-button.tsx`, `avatar-with-status-indicator.tsx` | 5 files deleted |
| 0.5 | Move `Skeleton.tsx` to `features/shared/Skeletons.tsx`, update imports in Dashboard, Config, Results, Session | 5 files |
| 0.6 | Move `ErrorBanner` to `features/shared/ErrorBanner.tsx`, update imports | 5 files |

**Validation:** `npm run build` passes. No visual changes.

---

### Phase A: Primitive Swap (no page redesign)

Replace hand-rolled primitives with shadcn equivalents. Each step is an independent PR. Pages continue to look and behave exactly the same.

| Step | Primitive | Install command | Then |
|---|---|---|---|
| A.1 | **Skeleton** | `npx shadcn@latest add skeleton` | Rewrite compound skeletons in `features/shared/Skeletons.tsx` to compose shadcn `Skeleton`. |
| A.2 | **Button** | (already installed) | Add AutoCoach variants to `button.tsx`. Replace inline `<button>` / `<motion.button>` across all pages. Wrap with Framer Motion where needed. |
| A.3 | **Input + Label** | `npx shadcn@latest add input label` | Replace inline `<input>` in Login, Signup, Config, Settings. |
| A.4 | **AlertDialog** | `npx shadcn@latest add alert-dialog` | Build `ConfirmDialog` wrapper. Swap in Dashboard. Delete `ConfirmModal.tsx`. |
| A.5 | **DropdownMenu** | `npx shadcn@latest add dropdown-menu` | Rewrite `AvatarDropdown` to use `DropdownMenu` + shadcn `Avatar`. |
| A.6 | **Sonner** | `npx shadcn@latest add sonner` | Replace `ToastProvider` + `useToast`. Delete `Toast.tsx` + `useToast.ts`. |
| A.7 | **Badge** | `npx shadcn@latest add badge` | Rewrite `StatusBadge` to compose shadcn `Badge`. |
| A.8 | **Progress** | `npx shadcn@latest add progress` | Replace all 3 progress bar implementations. |
| A.9 | **Accordion** | `npx shadcn@latest add accordion` | Replace expand/collapse in `ReviewRow.tsx` (Results page). |
| A.10 | **Checkbox** | `npx shadcn@latest add checkbox` | Replace inline checkbox in Signup. |

**Validation per step:** `npm run build` passes. Manual smoke test on affected pages. No visual regression beyond minor pixel-level differences from Radix's DOM structure.

---

### Phase B: Page-Level Component Extraction

Move inline components out of page files. Introduce react-hook-form + zod. Still no redesign.

| Step | Scope | Action |
|---|---|---|
| B.1 | **Auth forms** | Extract `GoogleIcon`, `AppleIcon` to `components/icons/`. Extract `SocialLoginButtons` to `components/features/auth/`. Rewrite Login + Signup forms with react-hook-form + zod. |
| B.2 | **Dashboard** | Extract `DocumentCard` (~150 lines) and `EmptyState` (~50 lines) to `components/features/dashboard/`. |
| B.3 | **Config** | Wire config stepper to react-hook-form (multi-step form state). Install `@formcn` auth/multi-step blocks if suitable. |
| B.4 | **Session** | Extract timer logic into `useTimer` hook. Consolidate inline progress bar (already replaced in A.8). |
| B.5 | **Settings** | Rewrite settings form with react-hook-form + zod. Wire avatar upload to form state. |
| B.6 | **Upload** | Extract drop zone into `components/features/upload/DropZone.tsx`. |

**Validation per step:** `npm run build` passes. Page behavior unchanged. Forms gain zod validation.

---

### Phase C: Inconsistent Page Rebuilds

These pages are visually broken or orphaned. Rebuild them on the now-standardized primitive layer.

| Step | Page | Problem | Action |
|---|---|---|---|
| C.1 | **`/analytics`** | Uses light-mode styling, custom header, Tailwind default colors, no `AppShell`. | Rebuild with `AppShell` + v2 dark tokens + shadcn primitives. Add real analytics data (quiz history, score trends). |
| C.2 | **`/feedback`** | Static mock, not connected to quiz flow, uses `dark:` variants, own header. | **Decision needed:** delete (real feedback lives in `FeedbackPanel`) or repurpose as a standalone review page. Default recommendation: delete. |
| C.3 | **Landing page** (`/`) | 1487-line monolith, legacy light-mode tokens, 10 inline section components, dead links. | Extract sections to `components/features/landing/`. Replace inline accordion with shadcn `Accordion`. Replace inline buttons with shadcn `Button`. Migrate from legacy tokens to v2 tokens. This is the highest-effort step. |
| C.4 | **Auth layout** | Uses legacy tokens. | Migrate `(auth)/layout.tsx`, `login/page.tsx`, `signup/page.tsx` to v2 tokens. |
| C.5 | **globals.css cleanup** | ~400 lines of legacy CSS utility classes become unused after C.3/C.4. | Audit and remove dead CSS blocks. Remove legacy token declarations from `:root`. |

**Validation:** Full visual QA on every page. Lighthouse accessibility audit. `npm run build` clean.

---

## 4. Summary Timeline

```
Phase 0  ██  Foundation (1 PR)
              ↓
Phase A  ██████████  Primitives (10 PRs, independent)
              ↓
Phase B  ████████  Page extractions (6 PRs, independent)
              ↓
Phase C  ██████████  Rebuilds (5 PRs, sequential for landing)
```

Each phase gate: `npm run build` passes, no visual regressions on affected pages.
