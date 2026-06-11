"use client";

import { cn } from "@/lib/utils";
import {
  type MilestoneLevel,
  milestoneLabel,
  milestoneFromMastery,
} from "@/lib/milestones";

interface MilestoneBadgeProps {
  level?: MilestoneLevel;
  mastery?: number;
  showPct?: boolean;
  className?: string;
}

const levelColor: Record<MilestoneLevel, string> = {
  apprentice: "border-[var(--line-default)] text-[var(--fg-secondary)]",
  scholar: "border-[var(--accent)] text-[var(--accent-text)]",
  expert: "border-[var(--line-strong)] text-[var(--fg-primary)]",
  master: "border-[var(--accent)] text-[var(--accent-text)]",
};

export function MilestoneBadge({
  level,
  mastery,
  showPct = true,
  className,
}: MilestoneBadgeProps) {
  const resolvedLevel: MilestoneLevel = level ?? milestoneFromMastery(mastery ?? 0);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        "h-[22px] px-2.5 rounded-none border bg-transparent",
        "font-mono text-[11px] uppercase tracking-[0.12em]",
        levelColor[resolvedLevel],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      <span>{milestoneLabel(resolvedLevel)}</span>
      {showPct && mastery !== undefined && (
        <>
          <span className="text-[var(--fg-disabled)]">·</span>
          <span className="text-[var(--fg-primary)] tabular-nums">
            {Math.round(mastery)}%
          </span>
        </>
      )}
    </span>
  );
}
