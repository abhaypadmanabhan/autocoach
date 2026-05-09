import { cn } from "@/lib/utils";

export function WhyInset({
  label = "Why",
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "p-3 px-4 rounded-md bg-[var(--bg-inset)] border border-[var(--line-subtle)]",
        className,
      )}
    >
      <span className="block mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
        {label}
      </span>
      <p className="m-0 text-[14px] leading-[1.55] text-[var(--fg-secondary)]">
        {children}
      </p>
    </div>
  );
}
