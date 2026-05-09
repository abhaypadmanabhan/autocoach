import { cn } from "@/lib/utils";

export function ProgressHairline({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative h-px w-full overflow-hidden bg-[var(--line-subtle)]", className)}
    >
      <span
        className="absolute left-0 top-0 bottom-0 bg-[var(--accent)] transition-[width] duration-[240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
