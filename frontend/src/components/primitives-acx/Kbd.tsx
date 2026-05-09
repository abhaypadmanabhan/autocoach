import { cn } from "@/lib/utils";

export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center font-mono text-[10.5px] leading-[1.4]",
        "px-1.5 py-px rounded-sm",
        "border border-[var(--line-default)] bg-[var(--bg-base)] text-[var(--fg-tertiary)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
