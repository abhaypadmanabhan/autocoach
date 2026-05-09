import { cn } from "@/lib/utils";

interface ImportanceDotsProps {
  value: number;
  max?: number;
  className?: string;
}

export function ImportanceDots({ value, max = 5, className }: ImportanceDotsProps) {
  return (
    <span
      className={cn("inline-flex gap-[3px]", className)}
      role="img"
      aria-label={`Importance ${value} of ${max}`}
    >
      {Array.from({ length: max }, (_, i) => (
        <i
          key={i}
          className={cn(
            "block h-1.5 w-1.5 rounded-full",
            i < value ? "bg-[var(--fg-secondary)]" : "bg-[var(--line-strong)]",
          )}
        />
      ))}
    </span>
  );
}
