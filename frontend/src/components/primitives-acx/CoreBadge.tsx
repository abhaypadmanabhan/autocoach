import { cn } from "@/lib/utils";

export function CoreBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-px rounded-sm",
        "border border-[var(--accent-line)] bg-[var(--accent-fade)]",
        "font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--accent)]",
        className,
      )}
    >
      Core
    </span>
  );
}
