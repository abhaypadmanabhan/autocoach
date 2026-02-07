"use client";

import { SentinelMascot } from "./SentinelMascot";
import { useMascotManager } from "@/hooks/useMascotManager";
import { cn } from "@/lib/utils";

type Mode = "dashboard" | "loading" | "quiz" | "results";
type AnswerState = "idle" | "correct" | "wrong";

interface MascotStageProps {
  mode: Mode;
  isLoading?: boolean;
  answerState?: AnswerState;
  timedOut?: boolean;
  scorePercent?: number;
  className?: string;
}

export function MascotStage({
  mode,
  isLoading,
  answerState,
  timedOut,
  scorePercent,
  className,
}: MascotStageProps) {
  const { variant, message, sizeClass } = useMascotManager({
    mode,
    isLoading,
    answerState,
    timedOut,
    scorePercent,
  });

  return (
    <div className={cn("flex items-center gap-3 p-3", className)}>
      <div className={cn("shrink-0", sizeClass)}>
        <SentinelMascot variant={variant} className="w-full h-full" />
      </div>
      {message && (
        <p className="text-sm text-text-secondary font-medium">
          {message}
        </p>
      )}
    </div>
  );
}
