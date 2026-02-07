"use client";

import { cn } from "@/lib/utils";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl bg-semantic-error/10 border border-semantic-error/30",
        "flex items-center justify-between gap-4"
      )}
    >
      <p className="text-sm text-semantic-error">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            "text-sm font-medium text-semantic-error",
            "hover:underline whitespace-nowrap"
          )}
        >
          Retry
        </button>
      )}
    </div>
  );
}
