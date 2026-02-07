"use client";

type Variant = "neutral" | "thinking" | "wrong" | "success" | "timeout";
type Mode = "dashboard" | "loading" | "quiz" | "results";
type AnswerState = "idle" | "correct" | "wrong";

interface UseMascotManagerParams {
  mode: Mode;
  isLoading?: boolean;
  answerState?: AnswerState;
  timedOut?: boolean;
  scorePercent?: number;
}

interface UseMascotManagerReturn {
  variant: Variant;
  message?: string;
  sizeClass: string;
}

const SIZE_CLASSES = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
} as const;

export function useMascotManager({
  mode,
  isLoading,
  answerState,
  timedOut,
  scorePercent,
}: UseMascotManagerParams): UseMascotManagerReturn {
  // Timeout takes highest priority
  if (timedOut) {
    return {
      variant: "timeout",
      message: "Time's up. Quick reset.",
      sizeClass: mode === "loading" ? SIZE_CLASSES.lg : SIZE_CLASSES.md,
    };
  }

  // Loading state
  if (isLoading) {
    return {
      variant: "thinking",
      message: "Mapping the key ideas…",
      sizeClass: SIZE_CLASSES.lg,
    };
  }

  // Quiz mode
  if (mode === "quiz") {
    if (answerState === "correct") {
      return {
        variant: "success",
        message: "Nice. Locking that in.",
        sizeClass: SIZE_CLASSES.md,
      };
    }
    if (answerState === "wrong") {
      return {
        variant: "wrong",
        message: "Close — let's correct it.",
        sizeClass: SIZE_CLASSES.md,
      };
    }
    return {
      variant: "thinking",
      message: "Pick the best answer.",
      sizeClass: SIZE_CLASSES.md,
    };
  }

  // Results mode
  if (mode === "results" && scorePercent !== undefined) {
    if (scorePercent >= 80) {
      return {
        variant: "success",
        message: "Solid run.",
        sizeClass: SIZE_CLASSES.md,
      };
    }
    if (scorePercent >= 40) {
      return {
        variant: "neutral",
        message: "Good progress.",
        sizeClass: SIZE_CLASSES.md,
      };
    }
    return {
      variant: "wrong",
      message: "We'll tighten this up.",
      sizeClass: SIZE_CLASSES.md,
    };
  }

  // Dashboard default
  return {
    variant: "neutral",
    message: "Ready when you are.",
    sizeClass: SIZE_CLASSES.md,
  };
}
