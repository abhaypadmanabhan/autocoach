"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Sparkles, Loader2 } from "lucide-react";

import { useReviewQueue } from "@/hooks/useReviewQueue";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function SmartReviewCard() {
  const { dueCount, conceptsPreview, dailyLimit, dailyLimitHit, isLoading, error } =
    useReviewQueue();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function handleStartReview() {
    setStarting(true);
    setStartError(null);
    try {
      const res = await apiFetch<{ session_id: string }>("/quiz/sessions/", {
        method: "POST",
        body: { mode: "review" },
      });
      router.push(`/session?session_id=${res.session_id}&mode=review`);
    } catch (err) {
      setStartError(getErrorMessage(err));
      setStarting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="border border-[var(--line-subtle)] bg-[var(--bg-base)] p-3 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-tertiary)]" />
        <span className="text-[13px] text-[var(--fg-tertiary)]">Loading review queue…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-[var(--danger)] bg-transparent p-3 flex items-start gap-3">
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
      <div className="border border-[var(--line-subtle)] bg-[var(--bg-base)] p-3">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center h-8 w-8 bg-[var(--bg-elev)] border border-[var(--line-subtle)]">
            <CheckCircle2 className="h-4 w-4 text-[var(--accent-text)]" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-medium text-[var(--fg-primary)]">All caught up</p>
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
      <div className="border border-[var(--line-subtle)] bg-[var(--bg-base)] p-3">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center h-8 w-8 bg-[var(--bg-elev)] border border-[var(--line-subtle)]">
            <Sparkles className="h-4 w-4 text-[var(--ink)]" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-medium text-[var(--fg-primary)]">
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
    <div className="border border-[var(--line-subtle)] bg-[var(--bg-base)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid place-items-center h-8 w-8 bg-[var(--bg-elev)] border border-[var(--line-subtle)]">
            <Sparkles className="h-4 w-4 text-[var(--ink)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-[var(--fg-primary)]">
              <span className="font-mono tabular-nums text-[var(--accent-text)]">{dueCount}</span>{" "}
              <span className="text-[var(--fg-secondary)]">due for review</span>
            </p>
            <p className="text-[13px] text-[var(--fg-secondary)] mt-1 truncate">
              {conceptsPreview.map((c) => c.name).join(" · ")}
            </p>
          </div>
        </div>
        <Button onClick={handleStartReview} disabled={starting}>
          {starting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Starting…
            </>
          ) : (
            "Start review"
          )}
        </Button>
      </div>
      {startError && (
        <p className="mt-2 text-[12px] text-[var(--danger)]">{startError}</p>
      )}
    </div>
  );
}
