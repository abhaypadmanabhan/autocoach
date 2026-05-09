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
        "inline-flex items-center gap-2 h-[22px] px-2.5 rounded-full",
        "border border-[color-mix(in_oklab,var(--success)_30%,var(--line-default))]",
        "bg-[color-mix(in_oklab,var(--success)_8%,var(--bg-elev))]",
        "font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--success)]",
        className,
      )}
    >
      <span
        className="relative flex h-1.5 w-1.5"
        aria-hidden
      >
        <span className="absolute inset-0 rounded-full bg-[var(--success)] opacity-75 animate-[pulse_2s_ease-in-out_infinite]" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
      </span>
      {children ?? "Live"}
    </span>
  );
}
