import { cn } from "@/lib/utils";

export function LivePill({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        "font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--accent-text)]",
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-[var(--accent)] opacity-75 animate-[pulse_2s_ease-in-out_infinite]" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      </span>
      {children ?? "Live"}
    </span>
  );
}
