# Blocks Sandbox

Registry blocks live here. These are third-party shadcn-compatible components
installed via the `shadcn` CLI from external registries configured in
`components.json`.

## Rules

- **Never paste block code directly into pages.** Import from this directory.
- Each subdirectory maps to a registry (`bundui/`, `formcn/`, `animbits/`).
- To add a new block, install via CLI and move the output here:
  ```bash
  npx shadcn@latest add @bundui/stat-cards-01
  # then move the generated file into blocks/bundui/
  ```

## Installed Blocks

| Block | Registry | Purpose |
|-------|----------|---------|
| `stat-cards-01` | @bundui | Dashboard stats card with metrics, deltas, dropdown actions |
| `stepper` | @formcn | Multi-step form indicator (horizontal/vertical) |
| `text-shimmer` | @animbits | Gradient shimmer sweep text animation |

## Registry URLs (from components.json)

- `@bundui` — https://bundui.io/r/{name}.json
- `@formcn` — https://formcn.dev/r/{name}.json
- `@animbits` — https://animbits.dev/r/{name}.json
- `@shadcraft` — https://free.shadcraft.com/r/{name}.json
