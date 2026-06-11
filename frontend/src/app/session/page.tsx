"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";

import {
  useSession,
  useSubmitAnswer,
  useCurrentQuestion,
  useNextQuestion,
} from "@/hooks/useQuiz";
import { useDocument } from "@/hooks/useDocuments";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/ui/Toast";
import type { AnswerResult, CurrentQuestion, QuestionType } from "@/lib/types";

import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProgressHairline } from "@/components/primitives-acx/ProgressHairline";
import { Kbd } from "@/components/primitives-acx/Kbd";
import { WhyInset } from "@/components/primitives-acx/WhyInset";
import { KeyboardHints } from "@/components/primitives-acx/KeyboardHints";

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function SessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? searchParams.get("id");
  const timerParam = searchParams.get("t");
  const initialTimer = timerParam ? parseInt(timerParam, 10) : null;

  const {
    session,
    loading: sessionLoading,
    error: sessionError,
    refetch: refetchSession,
  } = useSession(sessionId);
  const {
    question,
    loading: questionLoading,
    error: questionError,
    refetch: refetchQuestion,
  } = useCurrentQuestion(sessionId);
  const { submitAnswer, submitting, error: submitError } =
    useSubmitAnswer(sessionId);
  const { pollUntilReady } = useNextQuestion(sessionId);
  const { document } = useDocument(session?.document_id ?? null);

  const [answer, setAnswer] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [inputMethod, setInputMethod] = useState<"click" | "typed" | "voice">(
    "typed",
  );
  const [nextError, setNextError] = useState<string | null>(null);
  const startedTrackedRef = useRef(false);

  // Timer — init from sessionStorage to handle page refresh mid-session
  const [remaining, setRemaining] = useState<number | null>(() => {
    if (typeof window === "undefined" || !sessionId || !initialTimer) {
      return initialTimer;
    }
    const key = `quiz_timer_start_${sessionId}`;
    let start = sessionStorage.getItem(key);
    if (!start) {
      start = String(Date.now());
      sessionStorage.setItem(key, start);
    }
    const elapsed = Math.floor((Date.now() - parseInt(start, 10)) / 1000);
    return Math.max(0, initialTimer - elapsed);
  });
  const [timerActive, setTimerActive] = useState<boolean>(() => {
    if (typeof window === "undefined" || !sessionId || !initialTimer) return false;
    const key = `quiz_timer_start_${sessionId}`;
    const start = sessionStorage.getItem(key);
    if (!start) return Boolean(initialTimer);
    const elapsed = Math.floor((Date.now() - parseInt(start, 10)) / 1000);
    return initialTimer - elapsed > 0;
  });
  const [timeUp, setTimeUp] = useState<boolean>(() => {
    if (typeof window === "undefined" || !sessionId || !initialTimer) return false;
    const key = `quiz_timer_start_${sessionId}`;
    const start = sessionStorage.getItem(key);
    if (!start) return false;
    const elapsed = Math.floor((Date.now() - parseInt(start, 10)) / 1000);
    return initialTimer - elapsed <= 0;
  });

  useEffect(() => {
    if (!sessionId) {
      router.push("/dashboard");
      return;
    }
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) router.push("/login");
    });
  }, [sessionId, router]);

  // Tick timer
  useEffect(() => {
    if (!timerActive || remaining === null || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((p) => {
        if (p === null || p <= 1) {
          clearInterval(id);
          setTimerActive(false);
          setTimeUp(true);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive, remaining]);

  // Time-up redirect
  useEffect(() => {
    if (timeUp && sessionId) {
      const t = setTimeout(() => {
        router.push(`/results?session_id=${sessionId}`);
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [timeUp, sessionId, router]);

  // Already complete → redirect
  useEffect(() => {
    if (session?.status === "completed" && sessionId) {
      router.replace(`/results?session_id=${sessionId}`);
    }
  }, [session?.status, sessionId, router]);

  // Track quiz_session_started once
  useEffect(() => {
    if (!sessionId || !session || !question || startedTrackedRef.current) return;
    if (question.question_number !== 1) return;
    analytics.capture("quiz_session_started", {
      document_id: session.document_id,
      session_id: sessionId,
      question_id: question.question_id,
    });
    startedTrackedRef.current = true;
  }, [sessionId, session, question]);

  const handleSubmit = useCallback(async () => {
    if (!question || !answer.trim() || timeUp || submitting) return;
    try {
      const trimmed = answer.trim();
      const result = await submitAnswer(question.question_id, trimmed, inputMethod);
      setLastResult(result.result);
      setIsComplete(result.session_complete);
      setShowFeedback(true);
    } catch {
      // surfaced via submitError
    }
  }, [answer, inputMethod, question, submitAnswer, submitting, timeUp]);

  const handleNext = useCallback(async () => {
    setShowFeedback(false);
    setAnswer("");
    setLastResult(null);
    setInputMethod("typed");
    setNextError(null);

    if (!sessionId) return;
    if (isComplete) {
      router.push(`/results?session_id=${sessionId}`);
      return;
    }

    try {
      const result = await pollUntilReady({ waitMs: 5000, maxAttempts: 4 });
      if (result.status === "ended") {
        setIsComplete(true);
        router.push(`/results?session_id=${sessionId}`);
        return;
      }
      if (result.status === "failed") {
        setNextError(result.message ?? "Couldn't load next question.");
        return;
      }
      await refetchQuestion();
      await refetchSession();
    } catch (err) {
      setNextError(err instanceof Error ? err.message : "Failed to fetch next question");
    }
  }, [isComplete, pollUntilReady, refetchQuestion, refetchSession, router, sessionId]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore typing in textareas (free text)
      const t = e.target as HTMLElement | null;
      const isTextarea =
        t?.tagName === "TEXTAREA" || (t as HTMLElement)?.isContentEditable;

      if (e.key === "Enter" && !e.shiftKey) {
        if (showFeedback) {
          e.preventDefault();
          handleNext();
          return;
        }
        if (!isTextarea && answer.trim()) {
          e.preventDefault();
          handleSubmit();
          return;
        }
        if (isTextarea && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          handleSubmit();
          return;
        }
      }

      // MCQ A-D / 1-4
      if (
        question?.options &&
        question.options.length > 0 &&
        !isTextarea &&
        !showFeedback
      ) {
        const upper = e.key.toUpperCase();
        const letterIdx = LETTERS.indexOf(upper as (typeof LETTERS)[number]);
        if (letterIdx >= 0 && letterIdx < question.options.length) {
          e.preventDefault();
          setAnswer(question.options[letterIdx]);
          setInputMethod("click");
          return;
        }
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= question.options.length) {
          e.preventDefault();
          setAnswer(question.options[num - 1]);
          setInputMethod("click");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, handleNext, handleSubmit, question, showFeedback]);

  const progress = session
    ? (session.answered_questions / session.total_questions) * 100
    : 0;

  const timerStatus =
    remaining === null
      ? null
      : remaining <= 10
        ? "critical"
        : remaining <= 30
          ? "warning"
          : "normal";

  const sessionComplete = !sessionLoading && !question && session?.status === "completed";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--fg-primary)]">
      <TopNav
        showBack
        backHref="/dashboard"
        eyebrow={document?.ai_title ?? document?.filename}
        title={
          session && question
            ? `Question ${question.question_number} of ${session.total_questions}`
            : "Loading"
        }
        showHud
        showSidebarTrigger={false}
        rightContent={
          remaining !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 h-[30px] px-3 border font-mono text-[12px] tabular-nums",
                timerStatus === "critical" &&
                  "border-[var(--danger)] text-[var(--danger)]",
                timerStatus === "warning" &&
                  "border-[var(--ink)] text-[var(--ink)]",
                timerStatus === "normal" &&
                  "border-[var(--line-default)] text-[var(--fg-secondary)]",
              )}
            >
              {formatTime(remaining)}
            </span>
          ) : undefined
        }
      />

      <ProgressHairline value={progress} />

      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-10">
        <div
          className={cn(
            "mx-auto transition-[max-width] duration-[240ms]",
            showFeedback ? "max-w-[1040px]" : "max-w-[720px]",
          )}
        >
          {sessionLoading || questionLoading ? (
            <div className="rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)] p-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-tertiary)]" />
            </div>
          ) : sessionError || questionError ? (
            <ErrorState
              message={sessionError ?? questionError ?? "Failed to load session"}
              onRetry={() => {
                refetchSession();
                refetchQuestion();
              }}
              onExit={() => router.push("/dashboard")}
            />
          ) : sessionComplete ? (
            <CompletionState sessionId={sessionId!} onView={() => router.push(`/results?session_id=${sessionId}`)} />
          ) : question ? (
            <div
              className={cn(
                "grid gap-6",
                showFeedback ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1",
              )}
            >
              <div className="border-2 border-[var(--ink)] shadow-hard bg-[var(--bg-base)] p-6 sm:p-8">
                <QuestionView
                  question={question}
                  answer={answer}
                  setAnswer={(v, m = "click") => {
                    setAnswer(v);
                    setInputMethod(m);
                  }}
                  showFeedback={showFeedback}
                  correctAnswer={lastResult?.correct_answer}
                  isCorrect={lastResult?.is_correct}
                  disabled={showFeedback || submitting || timeUp}
                />

                {!showFeedback && (
                  <div className="mt-6 flex items-center justify-between">
                    {submitError && (
                      <p className="text-[12px] text-[var(--danger)] flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3" />
                        {getErrorMessage(submitError)}
                      </p>
                    )}
                    <Button
                      onClick={handleSubmit}
                      disabled={!answer.trim() || submitting || timeUp}
                      size="lg"
                      className="ml-auto"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Submitting
                        </>
                      ) : timeUp ? (
                        "Time's up"
                      ) : (
                        <>
                          Submit
                          <Kbd className="ml-1">↵</Kbd>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {showFeedback && lastResult && (
                <aside className="anim-marg-in space-y-4 lg:pl-2">
                  <div
                    className={cn(
                      "p-4 border",
                      lastResult.is_correct
                        ? "border-[var(--accent)]"
                        : "border-[var(--danger)]",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {lastResult.is_correct ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-text)]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[var(--danger)]" />
                      )}
                      <span
                        className={cn(
                          "font-mono text-[11px] uppercase tracking-[0.08em]",
                          lastResult.is_correct
                            ? "text-[var(--accent-text)]"
                            : "text-[var(--danger)]",
                        )}
                      >
                        {lastResult.is_correct ? "Correct" : "Incorrect"}
                      </span>
                      {lastResult.xp_awarded != null && lastResult.xp_awarded !== 0 && (
                        <span className="ml-auto font-mono text-[11px] tabular-nums text-[var(--fg-secondary)]">
                          +{lastResult.xp_awarded} XP
                        </span>
                      )}
                    </div>
                  </div>

                  {!lastResult.is_correct && (
                    <div className="space-y-1.5">
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
                        You said
                      </span>
                      <p className="text-[14px] text-[var(--fg-secondary)] line-through decoration-[var(--line-default)]">
                        {answer || "—"}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5 border-l-2 border-[var(--accent)] bg-[var(--bg-inset)] pl-3 py-2">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
                      Correct answer
                    </span>
                    <p className="text-[14px] font-medium text-[var(--fg-primary)]">
                      {lastResult.correct_answer}
                    </p>
                  </div>

                  {lastResult.explanation && (
                    <WhyInset>{lastResult.explanation}</WhyInset>
                  )}

                  {nextError && (
                    <p className="text-[12px] text-[var(--danger)]">{nextError}</p>
                  )}

                  <Button onClick={handleNext} block size="lg">
                    {isComplete ? "View results" : "Next question"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </aside>
              )}
            </div>
          ) : null}
        </div>
      </main>

      {!showFeedback && question && (
        <KeyboardHints
          hints={[
            ...(question.options && question.options.length > 0
              ? [{ keys: ["A", "/", "1"], label: "Select" }]
              : []),
            { keys: ["↵"], label: "Submit" },
            { keys: ["esc"], label: "Exit" },
          ]}
        />
      )}

      {timeUp && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(23,23,23,0.4)]">
          <div className="text-center px-8 py-8 border-2 border-[var(--ink)] bg-[var(--bg-base)]">
            <div className="mx-auto h-14 w-14 grid place-items-center border border-[var(--danger)] mb-4">
              <AlertCircle className="h-6 w-6 text-[var(--danger)]" />
            </div>
            <h2 className="text-[24px] font-medium tracking-[-0.02em] text-[var(--fg-primary)] mb-2">
              Time&apos;s up
            </h2>
            <p className="text-[13px] text-[var(--fg-secondary)] mb-4">
              Redirecting to results…
            </p>
            <ProgressHairline value={100} className="w-48 mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionView({
  question,
  answer,
  setAnswer,
  showFeedback,
  correctAnswer,
  isCorrect,
  disabled,
}: {
  question: CurrentQuestion;
  answer: string;
  setAnswer: (v: string, method?: "click" | "typed" | "voice") => void;
  showFeedback: boolean;
  correctAnswer?: string;
  isCorrect?: boolean;
  disabled: boolean;
}) {
  const isMcq = (question.options?.length ?? 0) > 0;
  const isFreeText = question.question_type === "text_free";

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
          {questionTypeLabel(question.question_type)}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--fg-tertiary)]">
          {String(question.question_number).padStart(2, "0")}
        </span>
      </div>

      <h1 className="text-[20px] sm:text-[24px] font-medium leading-[1.4] tracking-[-0.01em] text-[var(--fg-primary)]">
        {question.question_text}
      </h1>

      {isMcq && question.options && (
        <div className="space-y-2">
          {question.options.map((opt, i) => {
            const letter = LETTERS[i] ?? String(i + 1);
            const selected = answer === opt;
            const correct = showFeedback && correctAnswer === opt;
            const wrong = showFeedback && selected && !isCorrect;
            return (
              <button
                key={i}
                type="button"
                disabled={disabled && !showFeedback}
                onClick={() => setAnswer(opt, "click")}
                className={cn(
                  "group relative w-full flex items-start gap-3 text-left p-3.5 border bg-[var(--bg-base)]",
                  "transition-[border-color,background-color] duration-[180ms]",
                  !showFeedback &&
                    !selected &&
                    "border-[var(--line-default)] hover:border-[var(--ink)]",
                  !showFeedback && selected && "border-2 border-[var(--ink)]",
                  correct && "border-2 border-[var(--accent)]",
                  wrong && "border-2 border-[var(--danger)]",
                  disabled && !showFeedback && "opacity-60 cursor-not-allowed",
                )}
              >
                {!showFeedback && selected && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--accent)]"
                  />
                )}
                <span
                  className={cn(
                    "shrink-0 h-6 w-6 grid place-items-center border font-mono text-[11px]",
                    !showFeedback &&
                      !selected &&
                      "border-[var(--line-default)] text-[var(--fg-tertiary)] group-hover:text-[var(--fg-secondary)]",
                    !showFeedback &&
                      selected &&
                      "border-[var(--ink)] bg-[var(--ink)] text-[#F9F1E6]",
                    correct && "border-[var(--accent)] bg-[var(--accent)] text-[var(--ink)]",
                    wrong && "border-[var(--danger)] bg-[var(--danger)] text-[#F9F1E6]",
                  )}
                >
                  {letter}
                </span>
                <span className="text-[14px] flex-1 text-[var(--fg-primary)]">
                  {opt}
                </span>
                {correct && <CheckCircle2 className="h-4 w-4 text-[var(--accent-text)]" />}
                {wrong && <XCircle className="h-4 w-4 text-[var(--danger)]" />}
              </button>
            );
          })}
        </div>
      )}

      {!isMcq && isFreeText && (
        <div className="space-y-1.5">
          <Textarea
            placeholder="Type your answer…"
            value={answer}
            disabled={disabled}
            onChange={(e) => setAnswer(e.target.value, "typed")}
            className="min-h-32"
          />
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--fg-tertiary)]">
            <span>Cmd/Ctrl + ↵ to submit</span>
            <span className="tabular-nums">{answer.length}</span>
          </div>
        </div>
      )}

      {!isMcq && !isFreeText && (
        <div className="grid grid-cols-2 gap-2">
          {["True", "False"].map((opt, i) => {
            const selected = answer.toLowerCase() === opt.toLowerCase();
            const correct = showFeedback && correctAnswer?.toLowerCase() === opt.toLowerCase();
            const wrong = showFeedback && selected && !isCorrect;
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled && !showFeedback}
                onClick={() => setAnswer(opt, "click")}
                className={cn(
                  "relative p-4 border bg-[var(--bg-base)] transition-[border-color,background-color] duration-[180ms]",
                  !showFeedback && !selected && "border-[var(--line-default)] hover:border-[var(--ink)]",
                  !showFeedback && selected && "border-2 border-[var(--ink)] text-[var(--ink)]",
                  correct && "border-2 border-[var(--accent)] text-[var(--accent-text)]",
                  wrong && "border-2 border-[var(--danger)] text-[var(--danger)]",
                )}
              >
                {!showFeedback && selected && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--accent)]"
                  />
                )}
                <span className="font-mono text-[13px] uppercase tracking-[0.06em]">
                  {opt}
                </span>
                <span className="block mt-1 font-mono text-[10.5px] text-[var(--fg-tertiary)]">
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function questionTypeLabel(t: QuestionType) {
  switch (t) {
    case "text_mcq":
      return "Multiple choice";
    case "text_tf":
      return "True / False";
    case "text_free":
      return "Free response";
    default:
      return "Question";
  }
}

function ErrorState({
  message,
  onRetry,
  onExit,
}: {
  message: string;
  onRetry: () => void;
  onExit: () => void;
}) {
  return (
    <div className="border-2 border-[var(--danger)] bg-[var(--bg-base)] p-8 text-center">
      <div className="mx-auto h-12 w-12 grid place-items-center border border-[var(--danger)] mb-4">
        <AlertCircle className="h-5 w-5 text-[var(--danger)]" />
      </div>
      <h2 className="text-[20px] font-medium text-[var(--fg-primary)] mb-2">
        Something went wrong
      </h2>
      <p className="text-[13px] text-[var(--fg-secondary)] mb-6 max-w-md mx-auto">
        {message}
      </p>
      <div className="flex gap-2 justify-center">
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
        <Button onClick={onExit}>Back to dashboard</Button>
      </div>
    </div>
  );
}

function CompletionState({
  onView,
}: {
  sessionId: string;
  onView: () => void;
}) {
  return (
    <div className="border border-[var(--line-subtle)] bg-[var(--bg-base)] p-12 text-center">
      <div className="mx-auto h-14 w-14 grid place-items-center border border-[var(--accent)] mb-5">
        <CheckCircle2 className="h-6 w-6 text-[var(--accent-text)]" />
      </div>
      <h2 className="text-[24px] font-medium tracking-[-0.02em] text-[var(--fg-primary)] mb-2">
        Session complete
      </h2>
      <Button onClick={onView} size="lg">
        View results
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function SessionPage() {
  return (
    <ToastProvider>
      <Suspense
        fallback={
          <div className="min-h-screen grid place-items-center bg-[var(--bg-base)]">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-tertiary)]" />
          </div>
        }
      >
        <SessionContent />
      </Suspense>
    </ToastProvider>
  );
}
