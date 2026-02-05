# UI Migration Log

## 2026-02-05 — Dashboard primitives migration

**Scope:** `src/app/dashboard/page.tsx` only. No other pages touched.

### What changed

| Before | After | Notes |
|---|---|---|
| `ConfirmModal` (custom, Framer Motion) | `AlertDialog` from `primitives/Modal` | Uses Radix controlled `open`/`onOpenChange`. `e.preventDefault()` on Action to keep dialog open during async delete. Danger icon + destructive button styling preserved. |
| `StatusBadge` (custom, inline styles) | `Badge` from `primitives/Badge` wrapped in `motion.div` | New inline `DocumentStatusBadge` maps status → variant (`success`, `destructive`, `secondary`, `processing`). Framer Motion entry animation preserved. Spinning icon for processing uses CSS `animate-spin`. Pulse dot uses Tailwind `animate-ping`. |
| `ProgressBar` (custom, Framer Motion width) | `Progress` from `primitives/Progress` | `progress` prop → `value`, `size="sm"` → `className="h-1"`. Uses Radix Progress with CSS `transition-all` instead of Framer Motion `animate={{ width }}`. |
| `DocumentCardSkeleton` / `StatCardSkeleton` / `ErrorBanner` imported from `ui/Skeleton` | Inline page-local components using `Skeleton` from `primitives/Skeleton` | Skeleton shapes rebuilt with the shadcn `Skeleton` primitive. `ErrorBanner` is a simple inline div (not a skeleton, just co-located). |

### Imports cleaned up

- **Removed:** `LogOut` (lucide, was unused), `cardLiftVariants` (motion, was unused), `StatusBadge`, `ProgressBar`, `ConfirmModal`, old skeleton imports
- **Added:** `Badge`, `Progress`, `Skeleton`, `AlertDialog*` (8 parts), `CheckCircle2`, `XCircle`, `AlertTriangle`

### Type-check result

- Dashboard: **0 errors** (was 3 — `DocumentCardSkeleton`, `StatCardSkeleton`, `ErrorBanner` missing exports)
- Other pages: 4 pre-existing errors remain (config, session, upload still import old Skeleton exports — to be fixed when those pages migrate)

### Not changed

- Page layout/structure — all sections, grids, cards remain identical
- All Framer Motion page animations (`staggerContainer`, `slideUpItem`, `whileHover`, etc.)
- Auth flow, data fetching, delete logic, routing
- No new dependencies added (AlertDialog primitives were already installed)
