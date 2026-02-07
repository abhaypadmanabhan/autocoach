"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/primitives/Skeleton";
import { AppShell, PageContainer } from "@/components/layout/AppShell";

// ── StatCardSkeleton ────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div
      className={cn(
        "p-6 rounded-2xl",
        "bg-surface-card border border-surface-border"
      )}
    >
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

// ── DocumentCardSkeleton ────────────────────────────────────────────

function DocumentCardSkeleton() {
  return (
    <div
      className={cn(
        "p-6 rounded-2xl",
        "border-2 border-surface-border bg-surface-card"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-4" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}

// ── DashboardSkeleton ───────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-8">
          {/* Hero skeleton */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <Skeleton className="h-10 w-48 mb-2" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-12 w-32 rounded-full" />
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>

          {/* Documents skeleton */}
          <div>
            <Skeleton className="h-8 w-40 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DocumentCardSkeleton />
              <DocumentCardSkeleton />
              <DocumentCardSkeleton />
            </div>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  );
}
