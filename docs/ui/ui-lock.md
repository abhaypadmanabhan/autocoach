# AutoCoach UI Lock

> **Status:** ENFORCED. Every PR touching `frontend/src/` must comply.
> **Last updated:** 2026-02-05

---

## 1. Design Tokens (Source of Truth)

The canonical token definitions live in `frontend/src/app/globals.css` inside the `:root` block. These are the **only** tokens the app may reference.

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
- **Landing page exception.** `app/page.tsx` and `app/(auth)/layout.tsx` may use the legacy light-mode tokens. This is a temporary exception -- these pages will be migrated to v2 last.
- **No `dark:` prefix usage.** The app does not toggle themes at runtime. Do not add `dark:` variant classes. If dark/light theming is needed in the future, it will be done via CSS variable reassignment on `:root`, not via Tailwind `dark:` variants.

---

## 3. Component Source Hierarchy

When you need a UI component, follow this order **strictly**. Use the first source that satisfies the requirement.

| Priority | Source | Registry | What it provides |
|---|---|---|---|
| 1 | **shadcn/ui** | `@shadcn` | Core primitives: Button, Input, Dialog, Sheet, Dropdown, Toast, Skeleton, Badge, Avatar, Accordion, Tabs, etc. |
| 2 | **shadcraft** | `@shadcraft` | Pre-composed blocks: hero sections, pricing cards, feature grids, navbars, footers. |
| 3 | **bundui** | `@bundui` | Animated/interactive blocks: animated cards, counters, testimonial carousels. |
| 4 | **formcn** | `@formcn` | Form blocks only: multi-step forms, auth forms, settings forms. Uses react-hook-form + zod internally. |
| 5 | **animbits** | `@animbits` | Motion primitives only: animated wrappers, transitions, scroll-triggered reveals. |
| 6 | **Custom** | n/a | Write from scratch only when no registry source exists. Must use shadcn primitives as building blocks. |

**All registry items must be installed via the shadcn CLI** (`npx shadcn@latest add <registry>/<item>`). This places them into the project source for full ownership and customization.

---

## 4. Hard Rules

### No new component libraries
The only allowed UI dependencies are **shadcn/ui** and **Radix UI** (pulled in transitively by shadcn). No MUI, Chakra, Mantine, Headless UI, Ant Design, or any other component library. Framer Motion and Lucide React remain the sole animation and icon dependencies.

### No copy-paste blocks into pages
Never paste a registry block's code directly into a `page.tsx` file. Instead:
1. Install it via CLI into `components/blocks/` (or `components/ui/` if it's a primitive).
2. Adapt it to use project tokens and conventions.
3. Import and compose it in the page.

### Forms must target react-hook-form + zod
All forms (login, signup, config, settings, upload) must use `react-hook-form` with `zod` schemas for validation. Existing `useState`-driven forms are tech debt -- new forms must follow this rule, and existing forms should be migrated when touched.

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

## 5. Folder Conventions

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
│   ├── motions.ts       # Framer Motion presets
│   ├── errorMessages.ts # Error display mapping
│   ├── validations/     # Zod schemas (target: one file per form)
│   └── supabase/        # Supabase client setup
│
└── app/                 # Next.js App Router pages (thin orchestration layers)
```

### Naming
- Component files: `PascalCase.tsx` (e.g., `QuestionCard.tsx`).
- Utility files: `camelCase.ts` (e.g., `motions.ts`).
- Zod schemas: `camelCase.ts` matching the form (e.g., `loginSchema.ts`).
- One exported component per file (co-located sub-components are fine if they're only used by the parent).

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
