# Registry Scan Log

> Generated 2026-02-05. Documents all methods used to enumerate components across registries.

---

## Method Overview

| Method | Tool | Result |
|--------|------|--------|
| MCP `list_items_in_registries` | shadcn MCP server | Works for @shadcn only |
| Fetch `{registry}/r/index.json` | WebFetch | 404 for all custom registries except @shadcraft (returned style, not component list) |
| Fetch `{registry}/r/{name}.json` | WebFetch | Works — per-component JSON is the only reliable method |
| Fetch registry website | WebFetch | Works for discovering category/component names (not exact slugs) |
| `npx shadcn@latest add @registry/name` | CLI | Works — installs if JSON resolves, errors clearly if not |

---

## @shadcn (core)

**Method**: MCP `list_items_in_registries` with `registries: ["@shadcn"]`, limit 160.

**Result**: Full enumeration successful. 403 total items returned across pages:
- ~57 `registry:ui` components (accordion through tooltip, kbd, native-select, etc.)
- ~9 `registry:block` sidebar variants
- ~5 `registry:block` login/signup blocks
- ~70+ `registry:block` chart variants (area, bar, line, pie, radar, radial, tooltip)
- Themes, utils, hooks

**Limitation**: The MCP tool only sees @shadcn. Custom registries configured in `components.json` are not enumerable via MCP.

---

## @bundui

**Registry URL**: `https://bundui.io/r/{name}.json`

### What worked

1. **Website fetch** (`https://bundui.io`) — returned full category listing with component names
2. **Per-component JSON fetch** — confirmed individual items:
   - `stat-cards-01` — 200, `meta.isPro: true`, deps: badge, button
   - `stat-cards-02` — 200, `meta.isPro: true`, deps: card, progress, tooltip
   - `counter-animation` — 200, `meta.isPro: false` (FREE), deps: motion
3. **CLI install** (`npx shadcn@latest add @bundui/stat-cards-01`) — works, installs files even for pro items

### What didn't work

- `https://bundui.io/r/index.json` — 404
- No registry index available

### Naming convention

Components use kebab-case with numeric suffix: `{category}-{nn}` (e.g., `stat-cards-01`, `counter-animation`).

### Discovered categories (from website)

- **Dashboard UI**: stat-cards (8 variants), tables, form-layouts, sign-in-forms, modal-dialogs, page-layouts, sidebar-layouts
- **E-commerce**: product-details, product-list, category-previews, shopping-carts, checkout-forms, etc.
- **Marketing**: hero-sections, pricing-sections, testimonials, cta-sections, feature-sections, bento-grids, footers, etc.
- **Motion**: counter-animation, sliding-number, countdown, parallax-cards, marquee-effect, scroll-progress-bar, etc.

### Limitations

- Cannot enumerate exact JSON slugs for unconfirmed items. Website shows display names, not registry names.
- Most items marked `isPro: true` in meta — full source is present in JSON anyway.
- Numbering pattern (e.g., stat-cards-01 through 08) is inferred from "8 variants" claim but only 01 and 02 tested.

---

## @shadcraft

**Registry URL**: `https://free.shadcraft.com/r/{name}.json`

### What worked

1. **Website fetch** (`https://free.shadcraft.com`) — returned component and block category list
2. **Per-component JSON fetch**:
   - `star-rating` — 200, `meta.bundle: "pro-marketing"`, type: `registry:ui`
   - `avatar-stack` — 200, `meta.bundle: "pro-marketing"`, type: `registry:ui`
   - `index` — 200, type: `registry:style` (base dependencies, not a component list)

### What didn't work

- `index.json` returned the style base config, not a component inventory

### Naming convention

Kebab-case, no numeric suffixes for components. Blocks may use different naming.

### Discovered items (from website)

**Components**: avatar-stack, marquee, page-heading, placeholder-logo, profile-card, section-heading, star-rating, tagline

**Blocks**: banners, benefits, blog-listings, careers, contact, cta, faqs, footers, heroes, metrics, newsletter-signup, pricing, social-proof, team, testimonials, top-navigation

### Limitations

- Marketing-focused registry — no dashboard or app-specific components.
- `meta.bundle: "pro-marketing"` on confirmed items — unclear if this blocks CLI install (it doesn't in practice).
- Exact JSON slugs for blocks are unconfirmed. Website display names may not match (e.g., "FAQ" might be `faqs` or `faq-01`).

---

## @formcn

**Registry URL**: `https://formcn.dev/r/{name}.json`

### What worked

1. **Per-component JSON fetch**:
   - `stepper` — 200, type: `registry:component`, deps: @radix-ui/react-slot, lucide-react
   - `tag-input` — 200, type: `registry:component`, deps: emblor
2. **CLI install** (`npx shadcn@latest add @formcn/stepper`) — works cleanly

### What didn't work

- `https://formcn.dev/r/index.json` — 404
- Website fetch returned marketing copy, not a component list
- `multi-step-form` — not tested (mentioned in site copy as a feature, may not be a standalone component)

### Limitations

- Very small registry. Only 2 items confirmed.
- Site focuses on a form builder tool, not a component library. Registry is secondary.
- No way to enumerate all items without guessing names.

---

## @animbits

**Registry URL**: `https://animbits.dev/r/{name}.json`

### What worked

1. **Website fetch** (`https://animbits.dev`) — returned component categories and names
2. **Per-component JSON fetch**:
   - `text-shimmer` — 200, type: `registry:component`, deps: custom hook
   - `text-blur-in` — 200, type: `registry:component`, deps: motion

### What didn't work

- `https://animbits.dev/r/index.json` — 404
- `parallax-tilt` — 404
- `card-parallax-tilt` — 404
- `ripple-button` — 404
- `motion-button` — 404
- `loader-orbit` — 404
- `stagger-fade` — 404
- `hover-glow` — 404

### Naming convention

**Inconsistent and unpredictable.** Website shows PascalCase component names (e.g., `RippleButton`, `CardParallaxTilt`) but the registry uses kebab-case with unknown mapping. Only `text-shimmer` and `text-blur-in` confirmed — both follow `{category}-{effect}` pattern. Other categories (buttons, cards, loaders) may use different slug patterns.

### Limitations

- **Most items cannot be confirmed** without trial-and-error on JSON URLs.
- High rate of 404s — 8 out of 10 guessed names failed.
- If the team wants specific animbits components, each must be individually verified by fetching the JSON URL before adding to the catalog.
- `text-shimmer` is BANNED for product use (continuous animation, looks cheap).

---

## Summary of Reliability

| Registry | Enumerable? | Confirmed Items | High-Confidence | Reliability |
|----------|------------|-----------------|-----------------|-------------|
| @shadcn | Yes (MCP) | 57 ui + 85+ blocks | All | High |
| @bundui | No (per-item) | 3 | ~30 | Medium (naming predictable) |
| @shadcraft | No (per-item) | 2 | ~24 | Medium (small registry) |
| @formcn | No (per-item) | 2 | 1 | Low (tiny registry) |
| @animbits | No (per-item) | 2 | ~16 | Low (naming inconsistent, high 404 rate) |

## Recommendations

1. **For future scans**: When needing a specific component, fetch `https://{registry}/r/{guessed-name}.json` first. If 404, try variant names before giving up.
2. **Registry indexes**: File issues with @bundui, @animbits, @formcn to publish a `registry.json` index — this is a standard shadcn registry feature they're not implementing.
3. **Prefer @shadcn core**: Highest reliability, full enumeration, Radix-based a11y, well-documented.
4. **@bundui is most useful**: Largest third-party catalog, predictable naming, rich dashboard/marketing blocks.
5. **@animbits is lowest value**: Naming is broken, most items unverifiable, and our motion policy (no shimmer, no flashy) limits what we'd use anyway.
