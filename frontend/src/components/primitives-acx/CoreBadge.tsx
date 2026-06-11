import { cn } from "@/lib/utils";

export function CoreBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-px rounded-none",
        "border border-[var(--accent)] bg-transparent",
        "font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--accent-text)]",
        className,
      )}
    >
      Core
    </span>
  );
}
