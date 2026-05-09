import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skel-pulse rounded-sm bg-[var(--bg-elev)]",
        className,
      )}
      {...props}
    />
  );
}

function QuestionCardSkeleton() {
  return (
    <div className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)] p-6 space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-3/4" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="p-3 rounded-md bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] border border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] flex items-center justify-between gap-4">
      <p className="text-[13px] text-[var(--danger)]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[12px] font-mono uppercase tracking-[0.08em] text-[var(--danger)] hover:underline whitespace-nowrap"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export { Skeleton, QuestionCardSkeleton, ErrorBanner };
