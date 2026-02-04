"use client";

import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export function Skeleton({ className = "", animate = true }: SkeletonProps) {
  return (
    <div
      className={`bg-surface-border/50 rounded ${animate ? "animate-pulse" : ""} ${className}`}
    />
  );
}

export function DocumentCardSkeleton() {
  return (
    <div className="relative p-6 rounded-2xl border-2 border-surface-border bg-surface-card">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <Skeleton className="w-20 h-6 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4 mb-2 rounded" />
      <Skeleton className="h-4 w-1/2 mb-4 rounded" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

export function QuestionCardSkeleton() {
  return (
    <div className="bg-surface-card rounded-3xl p-8 md:p-12 border border-surface-border">
      <Skeleton className="h-8 w-24 mb-6 rounded" />
      <Skeleton className="h-6 w-full mb-3 rounded" />
      <Skeleton className="h-6 w-3/4 mb-8 rounded" />
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-surface-card border border-surface-border">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-8 w-16 mb-1 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      </div>
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-semantic-error/10 border border-semantic-error/30 text-semantic-error"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{message}</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm font-medium hover:underline shrink-0"
          >
            Try again
          </button>
        )}
      </div>
    </motion.div>
  );
}
