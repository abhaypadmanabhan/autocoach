import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

function QuestionCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-border bg-white p-6 space-y-4">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-3/4" />
      <div className="space-y-3 pt-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-4 rounded-xl bg-error/10 border border-error/30 flex items-center justify-between gap-4">
      <p className="text-sm text-error">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-medium text-error hover:underline whitespace-nowrap">
          Retry
        </button>
      )}
    </div>
  )
}

export { Skeleton, QuestionCardSkeleton, ErrorBanner }
