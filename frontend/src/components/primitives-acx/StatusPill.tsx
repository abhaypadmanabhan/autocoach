import { cn } from "@/lib/utils";

type Variant = "ready" | "processing" | "failed" | "pending";

const variantStyles: Record<Variant, { color: string; dot: string; label: string }> = {
  ready: {
    color: "text-[var(--accent-text)]",
    dot: "bg-[var(--accent)]",
    label: "Ready",
  },
  processing: {
    color: "text-[var(--fg-secondary)]",
    dot: "bg-[var(--fg-secondary)]",
    label: "Processing",
  },
  failed: {
    color: "text-[var(--danger)]",
    dot: "bg-[var(--danger)]",
    label: "Failed",
  },
  pending: {
    color: "text-[var(--fg-tertiary)]",
    dot: "bg-[var(--fg-tertiary)]",
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
        "inline-flex items-center gap-1.5",
        "font-mono text-[11px] uppercase tracking-[0.06em]",
        v.color,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} aria-hidden />
      {label ?? v.label}
    </span>
  );
}
