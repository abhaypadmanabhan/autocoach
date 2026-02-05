# Design Lab — Design Decisions

## Background recipe

- Base: `--surface-dark` (#34344a) via AppShell's existing bg
- Glows: existing `.gradient-mesh` utility from globals.css
  (2 radial glows — brand-primary at 10%, brand-secondary at 8%)
- Noise: existing `.noise-bg` utility (SVG turbulence at 3% opacity)
- No new colors. All derived from tokens via opacity.

## Motion recipe

All motion from existing `src/lib/motions.ts` presets:

- **Scroll reveal:** `staggerContainer` + `slideUpItem` via `whileInView` (once: true)
- **Card hover:** `y: -2` lift + subtle border glow (`brand-primary/20` box-shadow)
  Uses `transitions.snappy` (0.3s ease). No bounce.
- **Header/hero:** stagger with `slideUpItem` variant, 0.1s child offset
- **Count-up numbers:** imperative `animate()` from framer-motion,
  triggered by `useInView`. One-shot, 1.5s expo ease-out.
- **Reduced motion:** all framer animations respect `prefers-reduced-motion`
  (framer-motion handles this natively)

## Typography recipe

Using the existing type scale from globals.css:

| Element         | Class               | Font              |
|-----------------|---------------------|-------------------|
| Hero title      | `text-h1`           | `font-heading` (Plus Jakarta Sans) |
| Section heading | `text-h2`           | `font-heading`    |
| Category label  | `text-small`        | `font-sans` (Inter) — uppercase, tracked |
| Body copy       | `text-body`         | `font-sans`       |
| Stat values     | `text-2xl tracking-tight` | `font-sans` tabular-nums |
| Count-up nums   | `text-numeral`      | `font-sans`       |
| Code/registry   | `font-mono text-xs` | monospace         |

Hero title uses `.gradient-text` (existing utility: brand-primary → brand-secondary).

## Card recipe

- Background: `bg-surface-card` (#3a3a52)
- Border: `border-surface-border/20` (Blue Slate at 20%)
- Text: `text-text-primary` for values, `text-text-secondary` for labels, `text-text-muted` for footers
- Delta chips: `bg-semantic-success/10 text-semantic-success` (positive),
  `bg-semantic-error/10 text-semantic-error` (negative). No shadcn Badge.
- Hover: `y: -2`, `box-shadow: 0 8px 24px brand-primary/10`. Subtle, no bounce.
- Section containers: `bg-surface-card/30 border-surface-border/15 rounded-2xl p-8`

## Shimmer replacement

Removed animbits shimmer. Replaced with **Animated Count-up** section:
- 3 large numerals that count from 0 → target on scroll
- Uses `framer-motion.animate()` + `useInView` (once: true)
- One-shot animation, no continuous motion
- Tabular numerals prevent layout shift during animation
