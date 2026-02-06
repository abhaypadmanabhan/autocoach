# AutoCoach Component Library Catalog

> Generated 2026-02-05. Source registries: @shadcn (core), @bundui, @shadcraft, @formcn, @animbits.
> Install base: `npx shadcn@latest add <name>` (core) or `npx shadcn@latest add @registry/<name>` (custom).

---

## Shortlist for AutoCoach

Curated best-fit candidates per app area. Components marked **[I]** are already installed.

### Landing Page (hero, pricing, testimonials, FAQ, CTA)

| Component | Registry | Rationale |
|-----------|----------|-----------|
| accordion **[I]** | @shadcn | FAQ sections — Radix-based, accessible |
| navigation-menu | @shadcn | Top nav with dropdowns — Radix, keyboard-friendly |
| carousel | @shadcn | Testimonial slider — embla-carousel |
| badge **[I]** | @shadcn | Feature tags, plan labels |
| card **[I]** | @shadcn | Pricing cards, feature cards |
| separator **[I]** | @shadcn | Section dividers |
| counter-animation | @bundui | Animated stat numbers (free, uses motion) |
| star-rating | @shadcraft | Social proof — partial-fill stars |
| avatar-stack | @shadcraft | Testimonial user photos |

### Dashboard (stats, tables, filters, cards, empty states)

| Component | Registry | Rationale |
|-----------|----------|-----------|
| card **[I]** | @shadcn | Stat cards, document cards |
| table | @shadcn | Document list, quiz history |
| badge **[I]** | @shadcn | Status badges (ready/processing/failed) |
| progress **[I]** | @shadcn | Mastery bars, upload progress |
| empty | @shadcn | Zero-state illustrations |
| dropdown-menu **[I]** | @shadcn | Card actions, filters |
| chart | @shadcn | Analytics — uses recharts |
| tabs **[I]** | @shadcn | Dashboard view switching |
| stat-cards-01 **[I]** | @bundui | Pre-built 4-card metrics grid (pro) |
| counter-animation | @bundui | Animated number transitions |

### Auth (forms, password, toasts)

| Component | Registry | Rationale |
|-----------|----------|-----------|
| input **[I]** | @shadcn | Email, password fields |
| label **[I]** | @shadcn | Form labels — Radix |
| button **[I]** | @shadcn | Submit, social login |
| form | @shadcn | react-hook-form + zod integration |
| input-otp | @shadcn | Email verification codes |
| dialog **[I]** | @shadcn | Password reset modals |
| sonner | @shadcn | Toast notifications (better than custom) |

### Study Flow (stepper, progress, timers, review)

| Component | Registry | Rationale |
|-----------|----------|-----------|
| progress **[I]** | @shadcn | Question progress bar |
| stepper **[I]** | @formcn | Multi-step quiz flow indicator |
| radio-group | @shadcn | MCQ answer selection |
| checkbox **[I]** | @shadcn | Multi-select answers |
| textarea **[I]** | @shadcn | Free-text answers |
| scroll-area | @shadcn | Long passage reading |
| sheet | @shadcn | Side panel for hints/feedback |
| tag-input | @formcn | Topic/concept tagging |
| slider | @shadcn | Difficulty selection, confidence rating |
| tooltip **[I]** | @shadcn | Explanation hovers |

---

## 1. Core shadcn/ui

### Installed (in `src/components/ui/`)

| Name | Type | Install | A11y | Theme | Notes |
|------|------|---------|------|-------|-------|
| accordion | ui | `npx shadcn@latest add accordion` | Radix, keyboard | Needs var scope | Already installed |
| alert-dialog | ui | `npx shadcn@latest add alert-dialog` | Radix, focus trap | Needs var scope | Already installed |
| avatar | ui | `npx shadcn@latest add avatar` | Radix | Needs var scope | Already installed |
| badge | ui | `npx shadcn@latest add badge` | Semantic | Token-ready (overridden) | Already installed |
| button | ui | `npx shadcn@latest add button` | Focus ring | Token-ready (overridden) | Already installed |
| card | ui | `npx shadcn@latest add card` | Semantic | Needs bg-surface-card override | Installed + CardAction added |
| checkbox | ui | `npx shadcn@latest add checkbox` | Radix, keyboard | Needs var scope | Already installed |
| dialog | ui | `npx shadcn@latest add dialog` | Radix, focus trap | Needs var scope | Already installed |
| dropdown-menu | ui | `npx shadcn@latest add dropdown-menu` | Radix, keyboard | Needs bg-surface-darker override | Already installed |
| input | ui | `npx shadcn@latest add input` | Label-linked | Needs var scope | Already installed |
| label | ui | `npx shadcn@latest add label` | Radix | Token-ready | Already installed |
| progress | ui | `npx shadcn@latest add progress` | Radix, aria-valuenow | Needs var scope | Already installed |
| separator | ui | `npx shadcn@latest add separator` | Radix | Token-ready | Already installed |
| skeleton | ui | `npx shadcn@latest add skeleton` | Decorative | Custom (already themed) | Custom impl with QuestionCardSkeleton |
| tabs | ui | `npx shadcn@latest add tabs` | Radix, keyboard | Needs var scope | Already installed |
| textarea | ui | `npx shadcn@latest add textarea` | Label-linked | Needs var scope | Already installed |
| tooltip | ui | `npx shadcn@latest add tooltip` | Radix, hover+focus | Needs var scope | Already installed |

Custom components (not from shadcn registry):
- `AvatarDropdown.tsx` — user menu dropdown (custom)
- `ConfirmModal.tsx` — delete confirmation (custom, migrating to AlertDialog)
- `DiamondButton.tsx` — brand motif button (custom)
- `ErrorCard.tsx` — error display (custom)
- `LoadingOverlay.tsx` — fullscreen loader (custom)
- `OptionPill.tsx` — quiz answer option (custom)
- `Skeleton.tsx` — custom skeletons + ErrorBanner (custom)
- `star-rating.tsx` — from @shadcraft registry
- `StatusBadge.tsx` — document status (custom)
- `Toast.tsx` — toast system (custom)

### Not Yet Installed (available from @shadcn)

| Name | Type | Install | Use Case | Motion | A11y | Deps | Approved |
|------|------|---------|----------|--------|------|------|----------|
| alert | ui | `npx shadcn@latest add alert` | Error/warning banners | None | Semantic roles | — | TBD |
| aspect-ratio | ui | `npx shadcn@latest add aspect-ratio` | Image containers | None | — | radix | TBD |
| breadcrumb | ui | `npx shadcn@latest add breadcrumb` | Page navigation trail | None | aria-current | — | TBD |
| button-group | ui | `npx shadcn@latest add button-group` | Grouped actions | None | Focus group | button | TBD |
| calendar | ui | `npx shadcn@latest add calendar` | Date picking | None | Keyboard nav | react-day-picker | TBD |
| carousel | ui | `npx shadcn@latest add carousel` | Testimonial slider | Subtle | aria-roledescription | embla-carousel | TBD |
| chart | ui | `npx shadcn@latest add chart` | Analytics graphs | None | — | recharts | TBD |
| collapsible | ui | `npx shadcn@latest add collapsible` | Expandable sections | Subtle | Radix, keyboard | — | TBD |
| combobox | ui | `npx shadcn@latest add combobox` | Searchable select | None | Radix command | command, popover | TBD |
| command | ui | `npx shadcn@latest add command` | Command palette | None | Keyboard, aria | cmdk | TBD |
| context-menu | ui | `npx shadcn@latest add context-menu` | Right-click menus | None | Radix, keyboard | — | TBD |
| drawer | ui | `npx shadcn@latest add drawer` | Mobile bottom sheet | Medium | Focus trap | vaul | TBD |
| empty | ui | `npx shadcn@latest add empty` | Zero/empty states | None | Semantic | — | TBD |
| field | ui | `npx shadcn@latest add field` | Form field wrapper | None | Label association | label | TBD |
| form | ui | `npx shadcn@latest add form` | Form validation | None | Error messages | react-hook-form, zod | TBD |
| hover-card | ui | `npx shadcn@latest add hover-card` | Preview on hover | Subtle | Radix | — | TBD |
| input-group | ui | `npx shadcn@latest add input-group` | Input with addons | None | Label-linked | input | TBD |
| input-otp | ui | `npx shadcn@latest add input-otp` | Verification codes | None | Keyboard, focus | input-otp lib | TBD |
| kbd | ui | `npx shadcn@latest add kbd` | Keyboard shortcut hints | None | Semantic | — | TBD |
| menubar | ui | `npx shadcn@latest add menubar` | App menubar | None | Radix, keyboard | — | TBD |
| native-select | ui | `npx shadcn@latest add native-select` | Native dropdown | None | Native a11y | — | TBD |
| navigation-menu | ui | `npx shadcn@latest add navigation-menu` | Top navigation | Subtle | Radix, keyboard | — | TBD |
| pagination | ui | `npx shadcn@latest add pagination` | Page navigation | None | aria-label | — | TBD |
| popover | ui | `npx shadcn@latest add popover` | Floating panels | Subtle | Radix, focus | — | TBD |
| radio-group | ui | `npx shadcn@latest add radio-group` | Single selection | None | Radix, keyboard | — | TBD |
| resizable | ui | `npx shadcn@latest add resizable` | Resizable panels | None | Keyboard resize | react-resizable-panels | TBD |
| scroll-area | ui | `npx shadcn@latest add scroll-area` | Custom scrollbars | None | Radix | — | TBD |
| select | ui | `npx shadcn@latest add select` | Dropdown select | Subtle | Radix, keyboard | — | TBD |
| sheet | ui | `npx shadcn@latest add sheet` | Side panel/drawer | Medium | Radix, focus trap | dialog | TBD |
| sidebar | ui | `npx shadcn@latest add sidebar` | App sidebar nav | Subtle | Keyboard nav | sheet, tooltip | TBD |
| slider | ui | `npx shadcn@latest add slider` | Range input | None | Radix, keyboard | — | TBD |
| sonner | ui | `npx shadcn@latest add sonner` | Toast notifications | Subtle | aria-live | sonner lib | TBD |
| spinner | ui | `npx shadcn@latest add spinner` | Loading indicator | Medium | aria-busy | — | TBD |
| switch | ui | `npx shadcn@latest add switch` | Toggle on/off | None | Radix, keyboard | — | TBD |
| table | ui | `npx shadcn@latest add table` | Data tables | None | Semantic HTML | — | TBD |
| toggle | ui | `npx shadcn@latest add toggle` | Toggle button | None | Radix, pressed state | — | TBD |
| toggle-group | ui | `npx shadcn@latest add toggle-group` | Button group toggle | None | Radix, roving focus | toggle | TBD |

### Core Blocks (selected, relevant to AutoCoach)

| Name | Install | Description | Approved |
|------|---------|-------------|----------|
| login-01 | `npx shadcn@latest add login-01` | Simple login form | TBD |
| login-02 | `npx shadcn@latest add login-02` | Two-column login with cover image | TBD |
| signup-01 | `npx shadcn@latest add signup-01` | Simple signup form | TBD |
| dashboard-01 | `npx shadcn@latest add dashboard-01` | Dashboard with sidebar, charts, data table | TBD |
| sidebar-07 | `npx shadcn@latest add sidebar-07` | Sidebar that collapses to icons | TBD |
| sidebar-16 | `npx shadcn@latest add sidebar-16` | Sidebar with sticky header | TBD |
| chart-line-interactive | `npx shadcn@latest add chart-line-interactive` | Interactive line chart | TBD |
| chart-bar-interactive | `npx shadcn@latest add chart-bar-interactive` | Interactive bar chart | TBD |
| chart-pie-donut-text | `npx shadcn@latest add chart-pie-donut-text` | Donut chart with center text | TBD |
| chart-radar-default | `npx shadcn@latest add chart-radar-default` | Radar chart (concept mastery) | TBD |
| chart-radial-text | `npx shadcn@latest add chart-radial-text` | Radial progress with text | TBD |

---

## 2. @bundui

> Registry URL: `https://bundui.io/r/{name}.json`
> Install: `npx shadcn@latest add @bundui/<name>`
> Note: Most blocks are **pro** (full source is in the JSON but marked `meta.isPro: true`).

### Confirmed Items (JSON resolves)

| Name | Free? | Install | Description | Use Case | Motion | Deps | Approved |
|------|-------|---------|-------------|----------|--------|------|----------|
| stat-cards-01 **[I]** | Pro | `npx shadcn@latest add @bundui/stat-cards-01` | 4-card metrics grid with deltas | Dashboard | None | badge, button, card, dropdown-menu | TBD |
| stat-cards-02 | Pro | `npx shadcn@latest add @bundui/stat-cards-02` | Pipeline/progress stat cards | Dashboard | None | card, progress, tooltip | TBD |
| counter-animation | Free | `npx shadcn@latest add @bundui/counter-animation` | Animated number transition | Dashboard, landing | Subtle | motion | TBD |

### High-Confidence Candidates (from bundui.io site, naming pattern: kebab-case)

**Dashboard UI** (naming pattern: `{category}-{nn}`)

| Candidate Name | Description | Use Case | Approved |
|---------------|-------------|----------|----------|
| stat-cards-03 through 08 | Variant stat card layouts | Dashboard | TBD |
| tables-01, tables-02 | Data table layouts | Document list | TBD |
| form-layouts-01 | Form layout blocks | Config, upload | TBD |
| sign-in-forms-01 | Sign-in form block | Auth | TBD |
| sidebar-layouts-01 | Sidebar layout block | App shell | TBD |
| page-layouts-01 | Page layout block | App shell | TBD |

**Marketing** (relevant to landing page)

| Candidate Name | Description | Use Case | Approved |
|---------------|-------------|----------|----------|
| hero-sections-01 | Landing hero block | Landing | TBD |
| pricing-sections-01 | Pricing table | Landing | TBD |
| testimonials-01 | Customer testimonials | Landing | TBD |
| faq-sections-01 | FAQ accordion | Landing | TBD |
| cta-sections-01 | Call-to-action block | Landing | TBD |
| feature-sections-01 | Feature grid | Landing | TBD |
| bento-grids-01 | Bento grid layout | Landing | TBD |
| footers-01 | Page footer | Landing | TBD |

**Motion** (use with caution — check motion intensity)

| Candidate Name | Description | Motion Level | Approved |
|---------------|-------------|-------------|----------|
| counter-animation | Number count-up | Subtle | TBD |
| sliding-number | Slot-machine number | Medium | TBD |
| countdown | Timer countdown | Subtle | TBD |
| scroll-progress-bar | Scroll indicator | Subtle | TBD |
| parallax-cards | 3D parallax on hover | Medium | TBD |
| marquee-effect | Scrolling text/logos | Medium | TBD |

> **Limitation**: Cannot enumerate full inventory — no registry index. Names above are inferred from site categories. Actual JSON paths may differ. Verify with fetch before using.

---

## 3. @shadcraft

> Registry URL: `https://free.shadcraft.com/r/{name}.json`
> Install: `npx shadcn@latest add @shadcraft/<name>`
> Note: Items often have `meta.bundle: "pro-marketing"` — source is still in JSON.

### Confirmed Items (JSON resolves)

| Name | Bundle | Install | Description | Use Case | Motion | Deps | Approved |
|------|--------|---------|-------------|----------|--------|------|----------|
| star-rating **[I]** | pro-marketing | `npx shadcn@latest add @shadcraft/star-rating` | Partial-fill star rating | Landing, results | None | lucide-react | TBD |
| avatar-stack | pro-marketing | `npx shadcn@latest add @shadcraft/avatar-stack` | Overlapping avatar row | Landing, testimonials | None | avatar | TBD |

### High-Confidence Candidates (from free.shadcraft.com site)

**Components**

| Candidate Name | Description | Use Case | Approved |
|---------------|-------------|----------|----------|
| marquee | Scrolling text/logo strip | Landing | TBD |
| page-heading | Page title with breadcrumb | All pages | TBD |
| placeholder-logo | Brand logo placeholder | Dev/prototyping | TBD |
| profile-card | User profile card | Settings | TBD |
| section-heading | Section title + description | Landing, dashboard | TBD |
| tagline | Brand tagline text | Landing | TBD |

**Marketing Blocks**

| Candidate Name | Description | Use Case | Approved |
|---------------|-------------|----------|----------|
| heroes | Hero section block | Landing | TBD |
| pricing | Pricing table block | Landing | TBD |
| testimonials | Testimonial block | Landing | TBD |
| faqs | FAQ accordion block | Landing | TBD |
| cta | Call-to-action block | Landing | TBD |
| benefits | Feature/benefit cards | Landing | TBD |
| metrics | Stat metrics display | Dashboard, landing | TBD |
| social-proof | Trust badges | Landing | TBD |
| newsletter-signup | Email capture form | Landing | TBD |
| footers | Page footer block | Landing | TBD |
| top-navigation | Nav bar block | All pages | TBD |
| banners | Announcement banners | All pages | TBD |
| contact | Contact form block | Landing | TBD |
| team | Team member grid | Landing | TBD |
| careers | Job listing block | Landing | TBD |
| blog-listings | Blog post grid | Landing | TBD |

> **Limitation**: No registry index. Exact JSON names unverified for most. May require `-01` suffix or different kebab-case.

---

## 4. @formcn

> Registry URL: `https://formcn.dev/r/{name}.json`
> Install: `npx shadcn@latest add @formcn/<name>`
> Focus: Form primitives and multi-step patterns.

### Confirmed Items (JSON resolves)

| Name | Install | Description | Use Case | Motion | Deps | Approved |
|------|---------|-------------|----------|--------|------|----------|
| stepper **[I]** | `npx shadcn@latest add @formcn/stepper` | Multi-step indicator (h/v) | Study flow, upload wizard | None | radix-slot, lucide | TBD |
| tag-input | `npx shadcn@latest add @formcn/tag-input` | Tag/chip input field | Config (concept tags) | None | emblor | TBD |

### High-Confidence Candidates

| Candidate Name | Description | Use Case | Approved |
|---------------|-------------|----------|----------|
| multi-step-form | Complete multi-step form | Upload wizard | TBD |

> **Limitation**: Very small registry. Only 2 items confirmed. Site mentions "stepper, tag input, and more" but no enumerable index.

---

## 5. @animbits

> Registry URL: `https://animbits.dev/r/{name}.json`
> Install: `npx shadcn@latest add @animbits/<name>`
> Focus: Framer Motion micro-animations. **Warning: shimmer is banned for product use.**

### Confirmed Items (JSON resolves)

| Name | Install | Description | Motion Level | Deps | Approved |
|------|---------|-------------|-------------|------|----------|
| text-shimmer **[I]** | `npx shadcn@latest add @animbits/text-shimmer` | Gradient text sweep | High | custom hook | **BANNED** |
| text-blur-in | `npx shadcn@latest add @animbits/text-blur-in` | Text fade-in with blur | Subtle | motion | TBD |

### High-Confidence Candidates (from animbits.dev site)

> **Warning**: Naming convention is inconsistent. Many 404 on obvious kebab-case names.
> Only `text-shimmer` and `text-blur-in` confirmed. Others require probing.

| Candidate Name | Category | Description | Motion Level | Approved |
|---------------|----------|-------------|-------------|----------|
| text-scramble | Text | Character scramble effect | Medium | TBD |
| heartbeat-icon | Icons | Pulsing icon animation | Medium | TBD |
| pulse-icon | Icons | Pulse effect on icons | Subtle | TBD |
| spin-icon | Icons | Spinning icon | Medium | TBD |
| stagger-fade | Lists | Staggered list fade-in | Subtle | TBD |
| card-parallax-tilt | Cards | 3D tilt on hover | Medium | TBD |
| ripple-button | Buttons | Material ripple effect | Medium | TBD |
| magnetic-button | Buttons | Cursor-follow button | High | TBD |
| motion-button | Buttons | Animated button | Medium | TBD |
| github-button | Buttons | GitHub-styled button | Subtle | TBD |
| loader-orbit | Loaders | Orbiting loader | Medium | TBD |
| loader-gooey | Loaders | Gooey blob loader | High | TBD |
| loader-morphing | Loaders | Shape-morphing loader | High | TBD |
| page-transition-fade | Transitions | Page fade transition | Subtle | TBD |
| theme-toggle-circular | Transitions | Dark/light toggle | Medium | TBD |
| bento-grid | Layout | Animated bento grid | Subtle | TBD |

> **Limitation**: No registry index. Most names above are guesses from the website. Many 404 — actual names may use different conventions (e.g. `RippleButton` → unknown slug). Only use after verifying the JSON URL resolves.

---

## Theme Compatibility Notes

All shadcn components use CSS variables (`--color-primary`, `--color-muted`, etc.) that are **not fully mapped** to AutoCoach tokens. When using any shadcn/registry component:

1. **Override via className** — pass `className="bg-surface-card text-text-primary ..."` directly
2. **Scope via CSS vars** — wrap in a div with `style={{ '--color-primary': 'var(--brand-primary)', ... }}`
3. **Both approaches demonstrated** in the Design Lab page (`/dev/blocks`)

Components marked "Token-ready" have already been overridden in the codebase. Components marked "Needs var scope" require one of the above approaches.

---

## Alignment Rules

- **No shimmer** — `@animbits/text-shimmer` is banned. Continuous gradient animations are off-brand.
- **Prefer Radix-based** — better a11y, keyboard support, focus management out of the box.
- **Motion budget**: subtle one-shot reveals and hover lifts only. No continuous, looping, or high-intensity animations.
- **Token lock**: use `--brand-primary`, `--brand-secondary`, `--surface-*`, `--text-*` only. No new hex values.
- **Dark-first**: all components must work on `--surface-dark` (#34344a) background.
