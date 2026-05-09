"use client";

import Link from "next/link";
import { CheckCircle2, AlertTriangle, Sparkles, Loader2 } from "lucide-react";

import { useReviewQueue } from "@/hooks/useReviewQueue";
import { Button } from "@/components/ui/button";

export function SmartReviewCard() {
  const { dueCount, conceptsPreview, dailyLimit, dailyLimitHit, isLoading, error } =
    useReviewQueue();

  if (isLoading) {
    return (
      <div className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)] p-5 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-tertiary)]" />
        <span className="text-[13px] text-[var(--fg-tertiary)]">Loading review queue…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] p-5 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-[var(--danger)] mt-0.5" />
        <div>
          <p className="text-[14px] font-medium text-[var(--danger)]">Couldn&apos;t load review queue</p>
          <p className="text-[13px] text-[var(--fg-secondary)] mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (dueCount === 0) {
    return (
      <div className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)] p-5">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center h-9 w-9 rounded-md bg-[color-mix(in_oklab,var(--success)_10%,var(--bg-elev))] border border-[color-mix(in_oklab,var(--success)_30%,var(--line-default))]">
            <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-medium text-[var(--fg-primary)]">All caught up</p>
            <p className="text-[13px] text-[var(--fg-secondary)] mt-1">
              No concepts due for review today. Check back tomorrow.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (dailyLimitHit) {
    return (
      <div className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)] p-5">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center h-9 w-9 rounded-md bg-[color-mix(in_oklab,var(--warning)_10%,var(--bg-elev))] border border-[color-mix(in_oklab,var(--warning)_30%,var(--line-default))]">
            <Sparkles className="h-4 w-4 text-[var(--warning)]" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-medium text-[var(--fg-primary)]">
              Daily limit reached
            </p>
            <p className="text-[13px] text-[var(--fg-secondary)] mt-1">
              You&apos;ve reviewed {dailyLimit} concepts today. Rest helps consolidate memory.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid place-items-center h-9 w-9 rounded-md bg-[var(--accent-fade)] border border-[var(--accent-line)]">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[var(--fg-primary)]">
              <span className="font-mono tabular-nums">{dueCount}</span>{" "}
              <span className="text-[var(--fg-secondary)]">due for review</span>
            </p>
            <p className="text-[13px] text-[var(--fg-secondary)] mt-1 truncate">
              {conceptsPreview.map((c) => c.name).join(" · ")}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/session?mode=review">Start review</Link>
        </Button>
      </div>
    </div>
  );
}
