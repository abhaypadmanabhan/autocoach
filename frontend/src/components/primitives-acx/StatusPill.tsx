import { cn } from "@/lib/utils";

type Variant = "ready" | "processing" | "failed" | "pending";

const variantStyles: Record<Variant, { color: string; label: string }> = {
  ready: {
    color:
      "border-[color-mix(in_oklab,var(--success)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--success)_8%,var(--bg-elev))] text-[var(--success)]",
    label: "Ready",
  },
  processing: {
    color:
      "border-[color-mix(in_oklab,var(--warning)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--warning)_8%,var(--bg-elev))] text-[var(--warning)]",
    label: "Processing",
  },
  failed: {
    color:
      "border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] text-[var(--danger)]",
    label: "Failed",
  },
  pending: {
    color: "border-[var(--line-default)] bg-[var(--bg-elev)] text-[var(--fg-secondary)]",
    label: "Pending",
  },
};

export function StatusPill({
  variant,
  label,
  className,
}: {
  variant: Variant;
  label?: string;
  className?: string;
}) {
  const v = variantStyles[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full border",
        "font-mono text-[11px] uppercase tracking-[0.06em]",
        v.color,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label ?? v.label}
    </span>
  );
}
