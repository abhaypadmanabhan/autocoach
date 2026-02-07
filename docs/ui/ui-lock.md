# AutoCoach UI Lock

> **Status:** ENFORCED. Every PR touching `frontend/src/` must comply.
> **Last updated:** 2026-02-06

---

## 1. Design Tokens (Single Source of Truth)

`frontend/src/app/globals.css` `:root` block is the **single source of truth** for every design token. No other file may define colors, spacing scales, or font stacks. If a value isn't in `:root`, it doesn't exist.

**Dark-first.** All app surfaces (protected routes) render against the v2 dark token set. The landing page and auth pages may iterate on their own visual direction, but they must consume the same CSS variable contract — same variable names, potentially different values scoped to their layout if needed.

### v2 tokens (mandatory for all app routes)

```
Brand:     --brand-primary: #cd776a   --brand-secondary: #c18c5d
Surface:   --surface-dark: #34344a    --surface-darker: #2a2a3e
           --surface-card: #3a3a52    --surface-border: #495867
Semantic:  --semantic-success: #22c55e --semantic-error: #ef4444  --semantic-warning: #eab308
Text:      --text-primary: #f2f5de    --text-secondary: rgba(242,245,222,0.7)
           --text-muted: rgba(242,245,222,0.5)
```

### Legacy tokens (landing page scope only)

`--primary`, `--indigo-space`, `--background-light`, `--slate-border`, `--slate-text`, and the rest of the "Legacy colors" block. These tokens are **frozen**: no new code outside `app/page.tsx` and `app/(auth)/` may reference them. They will be migrated to v2 names last.

### shadcn mapping (to be applied at init)

When shadcn is initialized, map its CSS variable contract to v2 tokens:

```
--primary       -> --brand-primary
--secondary     -> --brand-secondary
--background    -> --surface-dark
--foreground    -> --text-primary
--card          -> --surface-card
--border        -> --surface-border
--muted         -> --text-muted (foreground) / --surface-darker (background)
--accent        -> --brand-secondary
--destructive   -> --semantic-error
--ring          -> --brand-primary
--input         -> --surface-border
```

### Typography

| Stack | Variable | Usage |
|---|---|---|
| Sans (body) | `--font-inter` | Default body, UI text |
| Heading | `--font-jakarta` | `.font-heading` utility |
| Serif (display) | hardcoded Playfair Display | `.font-serif` for h1/h2 on app pages |

No additional font families may be added without explicit approval.

---

## 2. Theme Rules

- **Dark-first.** All protected routes (`/dashboard`, `/upload`, `/config`, `/session`, `/results`, `/settings`, `/analytics`) use the v2 dark token set. `body` background is `--surface-dark`, text is `--text-primary`.
- **Landing page exception.** `app/page.tsx` and `app/(auth)/layout.tsx` may use the legacy light-mode tokens. This is a temporary exception — these pages will be migrated to v2 last. They must still reference the same CSS variable names (the contract), even if scoped values differ.
- **No `dark:` prefix usage.** The app does not toggle themes at runtime. Do not add `dark:` variant classes. If dark/light theming is needed in the future, it will be done via CSS variable reassignment on `:root`, not via Tailwind `dark:` variants.

---

## 3. Component Source Hierarchy

When you need a UI component, follow this order **strictly**. Use the first source that satisfies the requirement.

| Priority | Source | Registry | What it provides |
|---|---|---|---|
| 1 | **shadcn/ui** | `@shadcn` | Core primitives: Button, Input, Dialog, Sheet, Dropdown, Toast, Skeleton, Badge, Avatar, Accordion, Tabs, etc. |
| 2 | **shadcraft / bundui** | `@shadcraft` / `@bundui` | Pre-composed and animated blocks: hero sections, stat cards, counters, feature grids, navbars, footers. |
| 3 | **formcn** | `@formcn` | Form blocks only: multi-step forms, steppers, auth forms, settings forms. Uses react-hook-form + zod internally. |
| 4 | **animbits** (limited) | `@animbits` | Motion primitives only: animated wrappers, transitions, scroll-triggered reveals. **Use sparingly** — most motion needs are covered by `src/lib/motions.ts` presets. |
| 5 | **Custom** | n/a | Write from scratch only when no registry source exists. Must use shadcn primitives as building blocks. |

### Three-condition gate for registry components

A registry component may only be used in production code if **all three** conditions are met:

1. **Cataloged** — it appears in the shadcn registry catalog (`mcp__shadcn` tools or CLI)
2. **Approved** — it is listed in the Approved Patterns section below
3. **Installed into `blocks/`** — it was added via the shadcn CLI into `components/blocks/`, not copy-pasted

If any condition is unmet, the component cannot ship.

**All registry items must be installed via the shadcn CLI** (`npx shadcn@latest add <registry>/<item>`). This places them into the project source for full ownership and customization.

---

## 4. Approved Patterns

These patterns have been evaluated in the `/dev/blocks` design lab, themed with project tokens, and approved for production use.

### Approved

| Pattern | Source | Intended use | Notes |
|---|---|---|---|
| `@bundui/stat-cards-01` | `@bundui` | Dashboard metrics grid | Token-themed via `className` overrides. 4-column responsive grid. |
| `@formcn/stepper` | `@formcn` | Multi-step flow indicator | Token-themed via `StepperThemeScope` CSS variable wrapper (maps `--color-primary` etc. to project tokens). Supports horizontal and vertical orientations. |
| Scroll reveal | Custom (`InView`) | Section entrance animations | One-time `InView` trigger with `amount: 0.3`, stagger children. Uses `motions.ts` presets. |
| Hover lift | Custom CSS/Framer | Card interaction feedback | Card `-2px` Y-translate + shadow elevation, `0.3s` snappy transition. |
| Count-up | Custom (Framer Motion) | Animated numbers on stat cards | 1.5s duration, expo ease, one-shot on scroll into view. Supports decimal formatting and thousands separators. |

### Banned

| Pattern | Reason |
|---|---|
| `@animbits/text-shimmer` | Continuous gradient sweep — looks cheap and distracting |
| Any shimmer / continuous gradient animation | Conflicts with calm/premium posture |
| Parallax cards | Too flashy for a productivity tool |
| Marquee / ticker effects | Too flashy, distracting |
| Magnetic buttons | Novelty effect that doesn't serve the user |
| Continuous looping animations on visible UI | Loading spinners and progress indicators are exempted |

> **To propose a new pattern:** add it to `/dev/blocks`, theme it, evaluate it, then request addition to this list. See §7 Review Gate.

---

## 5. Hard Rules

### No new component libraries
The only allowed UI dependencies are **shadcn/ui** and **Radix UI** (pulled in transitively by shadcn). No MUI, Chakra, Mantine, Headless UI, Ant Design, or any other component library. Framer Motion and Lucide React remain the sole animation and icon dependencies.

### No copy-paste blocks into pages
Never paste a registry block's code directly into a `page.tsx` file. Instead:
1. Install it via CLI into `components/blocks/` (or `components/ui/` if it's a primitive).
2. Adapt it to use project tokens and conventions.
3. Import and compose it in the page.

### Forms must target react-hook-form + zod
All forms (login, signup, config, settings, upload) must use `react-hook-form` with `zod` schemas for validation. Existing `useState`-driven forms are tech debt — new forms must follow this rule, and existing forms should be migrated when touched.

### Always use `cn()` for class merging
Every component that conditionally applies Tailwind classes must use the `cn()` utility (`clsx` + `tailwind-merge`, located at `src/lib/utils.ts`). No raw template literal ternaries for class concatenation. Example:

```tsx
// correct
className={cn("px-4 py-2 rounded-xl", isActive && "bg-brand-primary text-surface-dark")}

// wrong
className={`px-4 py-2 rounded-xl ${isActive ? "bg-brand-primary text-surface-dark" : ""}`}
```

### No inline mega-components in page files
A `page.tsx` file may contain small inline helpers (< 30 lines, single use on that page). Anything larger must be extracted to a component file in the appropriate folder. The landing page's 10 inline section components (~1500 lines) is explicitly flagged as debt.

### Icon source
Lucide React is the only icon library. No Heroicons, no Font Awesome, no custom SVGs for standard icons. Brand icons (Google, Apple logos) live in `src/components/icons/` as shared components.

---

## 6. Motion Guidelines

**Posture: calm, premium, intentional.** Motion exists to communicate state changes and guide attention, not to entertain.

### Rules

- **Scroll reveals fire once.** Use `InView` with `amount: 0.3`. Once triggered, the element stays visible. No re-triggering on scroll back.
- **Hover/tap transforms stay subtle.** Maximum `-4px` Y-lift. `scale` must not exceed `1.02`. Transitions ≤ `0.3s`.
- **All motion presets must come from `src/lib/motions.ts`.** No inline `transition={{ duration: 0.5, ease: "easeOut" }}` definitions scattered across components. If a new preset is needed, add it to `motions.ts` first.
- **`prefers-reduced-motion`:** Framer Motion respects this media query by default. Never override it. Never wrap animations in a way that bypasses the user's system preference.
- **Duration budget:**
  - Scroll reveals: ≤ `0.6s`
  - Hover / tap feedback: ≤ `0.3s`
  - Page transitions: ≤ `0.6s`
  - Count-up animations: ≤ `1.5s`

### Anti-patterns

- Continuous looping animations on resting UI (spinners/loaders exempted)
- Animations that fight for attention (multiple simultaneous reveals in the viewport)
- Spring physics with visible bounce on functional UI (cards, buttons)
- Motion that blocks interaction (long entrance animations before content is interactive)

---

## 7. Review Gate

New registry components and motion patterns must pass through this pipeline before production use:

```
/dev/blocks gallery → theme with project tokens → evaluate → approve in ui-lock.md → production
```

### Steps

1. **Add to `/dev/blocks`** — install the component and create a demo section in the design lab page (`frontend/src/app/dev/blocks/page.tsx`).
2. **Theme it** — apply project tokens via `className` overrides or a CSS variable scope wrapper (see `StepperThemeScope` pattern).
3. **Evaluate** — check visual quality, motion intensity, dark-surface contrast, responsive behavior.
4. **Approve** — if it passes, add it to the Approved Patterns list in this document with its intended use-case.
5. **Ship** — only then may the component be imported in production pages.

Components that skip this pipeline must be reverted.

---

## 8. Folder Conventions

```
frontend/src/
├── components/
│   ├── ui/              # shadcn primitives (Button, Input, Dialog, etc.)
│   │                    # Installed via: npx shadcn@latest add <component>
│   │
│   ├── blocks/          # Registry blocks (shadcraft, bundui, formcn, animbits)
│   │                    # Installed via: npx shadcn@latest add <registry>/<block>
│   │                    # Adapted to project tokens after install
│   │
│   ├── icons/           # Shared SVG icon components (GoogleIcon, AppleIcon, etc.)
│   │
│   ├── layout/          # App shell, page containers, nav components
│   │
│   └── features/        # Feature-scoped components, one folder per feature:
│       ├── quiz/        # QuestionCard, FeedbackPanel, SetupStepper, TimerBar
│       ├── results/     # ScoreCircle, ReviewRow
│       ├── dashboard/   # DocumentCard, EmptyState, StatCards
│       ├── upload/      # DropZone, UploadProgress
│       ├── auth/        # SocialLoginButtons, PasswordStrength
│       └── landing/     # HeroSection, FeaturesSection, PricingSection, etc.
│
├── hooks/               # Custom React hooks (useQuiz, useDocuments, useToast, etc.)
│
├── lib/
│   ├── utils.ts         # cn() utility + shared helpers
│   ├── api.ts           # API client
│   ├── types.ts         # Shared TypeScript types
│   ├── motions.ts       # Framer Motion presets (single source for all durations/eases)
│   ├── errorMessages.ts # Error display mapping
│   ├── validations/     # Zod schemas (target: one file per form)
│   └── supabase/        # Supabase client setup
│
├── app/                 # Next.js App Router pages (thin orchestration layers)
│   └── dev/blocks/      # Design lab — evaluation-only gallery for registry components
│
└── docs/ui/             # This file and related UI governance docs
```

### Naming
- Component files: `PascalCase.tsx` (e.g., `QuestionCard.tsx`).
- Utility files: `camelCase.ts` (e.g., `motions.ts`).
- Zod schemas: `camelCase.ts` matching the form (e.g., `loginSchema.ts`).
- One exported component per file (co-located sub-components are fine if they're only used by the parent).

---

## 9. Do / Don't

| Do | Don't |
|----|-------|
| Use shadcn primitives first | Add new UI npm packages |
| Theme via CSS var scoping or `className` | Use inline hex colors |
| One-shot scroll reveals | Continuous / looping animations |
| Subtle hover lift (≤ 4px) | Shimmer, parallax, magnetic effects |
| Import presets from `src/lib/motions.ts` | Inline Framer Motion durations / eases |
| Install blocks via CLI into `blocks/` | Copy-paste block code into pages |
| Evaluate in `/dev/blocks` first | Ship unreviewed registry blocks |
| Use `cn()` for conditional classes | Raw template literal class ternaries |
| Reference v2 tokens on app surfaces | Use legacy tokens outside landing/auth |

---

## Enforcement Checklist (for PR review)

- [ ] New component uses `cn()` for conditional classes
- [ ] No new `dark:` variant usage
- [ ] Protected-route code references only v2 tokens (no `--primary`, `--slate-border`, etc.)
- [ ] Components > 30 lines are not inline in `page.tsx`
- [ ] Registry blocks are installed via CLI into `components/blocks/`, not pasted raw
- [ ] New forms use react-hook-form + zod (or are explicitly marked as migration debt with a TODO)
- [ ] No new icon imports from anything other than `lucide-react`
- [ ] No new npm dependencies for UI without explicit approval
- [ ] Registry component passes the three-condition gate (cataloged + approved + in `blocks/`)
- [ ] All motion uses presets from `src/lib/motions.ts` — no inline duration/ease definitions
- [ ] No continuous/looping animations added (spinners exempted)
- [ ] New pattern was evaluated in `/dev/blocks` before production use
- [ ] `prefers-reduced-motion` is not overridden or bypassed
