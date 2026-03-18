"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Timer,
  AlertCircle,
} from "lucide-react";
import { useSession, useSubmitAnswer, useCurrentQuestion } from "@/hooks/useQuiz";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { QuestionCardSkeleton, ErrorBanner } from "@/components/ui/Skeleton";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { TimerBar } from "@/components/quiz/TimerBar";
import { FeedbackPanel } from "@/components/quiz/FeedbackPanel";
import { ProgressBar } from "@/components/ui/StatusBadge";
import { MascotStage } from "@/components/brand/MascotStage";
import { staggerContainer, slideUpItem, pageVariants } from "@/lib/motions";
import type { AnswerResult } from "@/lib/types";

// Format seconds to mm:ss
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function SessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const timerParam = searchParams.get("t");
  const initialTimerSeconds = timerParam ? parseInt(timerParam, 10) : null;

  const { session, loading: sessionLoading, error: sessionError, refetch } = useSession(sessionId);
  const { question, loading: questionLoading, error: questionError, refetch: refetchQuestion } = useCurrentQuestion(sessionId);
  const { submitAnswer, submitting, error: submitError } = useSubmitAnswer(sessionId);

  const [answer, setAnswer] = useState<string>("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [inputMethod, setInputMethod] = useState<"click" | "typed" | "voice">("typed");
  const startedTrackedRef = useRef(false);
  const resumedTrackedRef = useRef(false);
  const abandonedTrackedRef = useRef(false);
  const seenQuestionIdsRef = useRef<Set<string>>(new Set());

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(() => {
    if (typeof window === "undefined" || !sessionId || !initialTimerSeconds) return initialTimerSeconds;
    const storageKey = `quiz_timer_start_${sessionId}`;
    let startTime = sessionStorage.getItem(storageKey);
    if (!startTime) {
      startTime = Date.now().toString();
      sessionStorage.setItem(storageKey, startTime);
    }
    const elapsed = Math.floor((Date.now() - parseInt(startTime, 10)) / 1000);
    return Math.max(0, initialTimerSeconds - elapsed);
  });

  const [timerActive, setTimerActive] = useState(() => {
    if (typeof window === "undefined" || !sessionId || !initialTimerSeconds) return false;
    const storageKey = `quiz_timer_start_${sessionId}`;
    const startTime = sessionStorage.getItem(storageKey) || Date.now().toString();
    if (!sessionStorage.getItem(storageKey)) {
      sessionStorage.setItem(storageKey, startTime);
    }
    const elapsed = Math.floor((Date.now() - parseInt(startTime, 10)) / 1000);
    return initialTimerSeconds - elapsed > 0;
  });

  const [timeUp, setTimeUp] = useState(() => {
    if (typeof window === "undefined" || !sessionId || !initialTimerSeconds) return false;
    const storageKey = `quiz_timer_start_${sessionId}`;
    const startTime = sessionStorage.getItem(storageKey) || Date.now().toString();
    if (!sessionStorage.getItem(storageKey)) {
      sessionStorage.setItem(storageKey, startTime);
    }
    const elapsed = Math.floor((Date.now() - parseInt(startTime, 10)) / 1000);
    return initialTimerSeconds - elapsed <= 0;
  });

  // Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push("/login");
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!sessionId) {
      router.push("/dashboard");
    }
  }, [sessionId, router]);

  useEffect(() => {
    startedTrackedRef.current = false;
    resumedTrackedRef.current = false;
    abandonedTrackedRef.current = false;
    seenQuestionIdsRef.current.clear();
  }, [sessionId]);

  // Redirect to results if session is already completed (handles refresh)
  useEffect(() => {
    if (session?.status === "completed" && sessionId) {
      router.replace(`/results?session_id=${sessionId}`);
    }
  }, [session?.status, sessionId, router]);

  useEffect(() => {
    if (!sessionId || !session || !question) return;
    if (startedTrackedRef.current) return;
    if (question.question_number !== 1) return;

    analytics.capture("quiz_session_started", {
      document_id: session.document_id,
      session_id: sessionId,
      question_id: question.question_id,
      question_number: question.question_number,
    });
    startedTrackedRef.current = true;
  }, [sessionId, session, question]);

  useEffect(() => {
    if (!sessionId || !session || !question) return;
    if (seenQuestionIdsRef.current.has(question.question_id)) return;

    analytics.capture("quiz_question_seen", {
      document_id: session.document_id,
      session_id: sessionId,
      question_id: question.question_id,
      question_number: question.question_number,
    });
    seenQuestionIdsRef.current.add(question.question_id);
  }, [sessionId, session, question]);

  useEffect(() => {
    if (!sessionId || !session || !question) return;
    if (resumedTrackedRef.current) return;
    if (session.status !== "active" || session.answered_questions <= 0) return;

    analytics.capture("quiz_resumed", {
      document_id: session.document_id,
      session_id: sessionId,
      question_id: question.question_id,
      question_number: question.question_number,
    });
    resumedTrackedRef.current = true;
  }, [sessionId, session, question]);

  useEffect(() => {
    if (!sessionId) return;

    const captureAbandoned = () => {
      if (!session || session.status === "completed" || isSessionComplete) return;
      if (abandonedTrackedRef.current) return;

      analytics.capture("quiz_abandoned", {
        document_id: session.document_id,
        session_id: sessionId,
        question_id: question?.question_id,
        question_number: question?.question_number,
      });
      abandonedTrackedRef.current = true;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        captureAbandoned();
      }
    };

    const onPageHide = () => {
      captureAbandoned();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [sessionId, session, question, isSessionComplete]);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          setTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

  // Auto-navigate when time's up
  useEffect(() => {
    if (timeUp && sessionId) {
      const timeout = setTimeout(() => {
        router.push(`/results?session_id=${sessionId}`);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [timeUp, sessionId, router]);

  const handleSubmit = async () => {
    if (!question || !answer.trim() || timeUp) return;

    try {
      // Always trim the answer before submitting
      const trimmedAnswer = answer.trim();
      setAnswer(trimmedAnswer);
      const result = await submitAnswer(question.question_id, trimmedAnswer, inputMethod);
      setLastResult(result.result);
      setIsSessionComplete(result.session_complete);
      setShowFeedback(true);
    } catch {
      // Error handled by hook
    }
  };

  const handleNext = () => {
    setShowFeedback(false);
    setAnswer("");
    setLastResult(null);
    setIsSessionComplete(false);
    setInputMethod("typed");
    refetchQuestion();
    refetch();
  };

  const handleAnswer = (selectedAnswer: string, method: "click" | "typed" | "voice" = "click") => {
    setAnswer(selectedAnswer);
    setInputMethod(method);
  };

  const progress = session ? ((session.answered_questions / session.total_questions) * 100) : 0;

  if (sessionLoading || questionLoading) {
    return (
      <div className="pb-32">
        <PageContainer size="lg">
          <div className="py-8">
            {/* Skeleton Progress Header */}
            <div className="mb-6">
              <div className="w-full bg-surface-border/30 rounded-full h-1" />
            </div>
            {/* Skeleton Question Card */}
            <QuestionCardSkeleton />
          </div>
        </PageContainer>
      </div>
    );
  }

  // Show error state
  if (sessionError || questionError) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 rounded-full bg-semantic-error/20 flex items-center justify-center mb-6"
        >
          <AlertCircle size={40} className="text-semantic-error" />
        </motion.div>
        <h2 className="text-h2 font-serif text-text-primary mb-2">Something went wrong</h2>
        <p className="text-text-muted mb-6 text-center max-w-md">
          {sessionError || questionError || "Unable to load the quiz session"}
        </p>
        <div className="flex gap-4">
          <motion.button
            onClick={() => {
              refetch();
              refetchQuestion();
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-xl border-2 border-surface-border text-text-primary font-semibold hover:bg-surface-card transition-colors"
          >
            Try Again
          </motion.button>
          <motion.button
            onClick={() => router.push("/dashboard")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-xl bg-brand-primary text-surface-dark font-semibold hover:bg-brand-primary/90 transition-colors"
          >
            Back to Dashboard
          </motion.button>
        </div>
      </div>
    );
  }

  // Show session complete
  if (!question && !showFeedback) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-semantic-success/20 flex items-center justify-center mb-6"
        >
          <CheckCircle size={40} className="text-semantic-success" />
        </motion.div>
        <h2 className="text-h2 font-serif text-text-primary mb-4">Session Complete!</h2>
        <motion.button
          onClick={() => router.push(`/results?session_id=${sessionId}`)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="
            px-8 py-3 rounded-xl
            bg-brand-primary text-surface-dark
            font-semibold
            hover:bg-brand-primary/90 transition-colors
          "
        >
          View Results
        </motion.button>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <PageContainer size="lg">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="py-8"
        >
          {/* Mascot Coach Strip */}
          <motion.div variants={slideUpItem} className="mb-4">
            <MascotStage
              mode="quiz"
              isLoading={submitting}
              answerState={showFeedback ? (lastResult?.is_correct ? "correct" : "wrong") : "idle"}
              timedOut={timeUp}
            />
          </motion.div>

          {/* Progress Header */}
          <motion.div variants={slideUpItem} className="mb-6">
            {/* Single progress bar — no text labels */}
            <div className="w-full bg-surface-border/30 rounded-full h-1 overflow-hidden">
              <motion.div
                className="h-full bg-brand-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Timer only — shown in timed mode */}
            {initialTimerSeconds && timeRemaining !== null && (
              <div className="flex justify-end mt-3">
                <div className="flex items-center gap-2 bg-surface-card px-3 py-1.5 rounded-xl border border-surface-border">
                  <Timer size={16} className={timeRemaining <= 10 ? "text-semantic-error" : "text-brand-secondary"} />
                  <span className={`font-mono text-base font-bold ${timeRemaining <= 10 ? "text-semantic-error" : "text-text-primary"}`}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Question Card */}
          <motion.div variants={slideUpItem}>
            {question && (
              <div className="bg-surface-card rounded-3xl p-8 md:p-12 border border-surface-border">
                <QuestionCard
                  number={question.question_number}
                  question={question.question_text}
                  type={question.question_type}
                  options={question.options || undefined}
                  onAnswer={handleAnswer}
                  selectedAnswer={answer}
                  showFeedback={showFeedback}
                  correctAnswer={lastResult?.correct_answer}
                  isCorrect={lastResult?.is_correct}
                />

                {/* Submit button */}
                {!showFeedback && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 flex justify-end"
                  >
                    <motion.button
                      onClick={handleSubmit}
                      disabled={!answer.trim() || submitting || timeUp}
                      whileHover={!answer.trim() || submitting || timeUp ? {} : { scale: 1.02 }}
                      whileTap={!answer.trim() || submitting || timeUp ? {} : { scale: 0.98 }}
                      className="
                        flex items-center gap-2 px-8 py-4 rounded-xl
                        font-semibold text-lg
                        transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed
                        bg-brand-primary text-surface-dark
                        hover:bg-brand-primary/90
                      "
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          Submitting...
                        </>
                      ) : timeUp ? (
                        "Time's Up"
                      ) : (
                        <>
                          Submit Answer
                          <ArrowRight size={20} />
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                )}

                {/* Error message */}
                {submitError && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-xl bg-semantic-error/10 border border-semantic-error/30 text-semantic-error flex items-center gap-2"
                  >
                    <AlertCircle size={18} />
                    {getErrorMessage(submitError)}
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      </PageContainer>

      {/* Feedback Panel */}
      <AnimatePresence>
        {showFeedback && lastResult && (
          <FeedbackPanel
            isCorrect={lastResult.is_correct}
            explanation={lastResult.explanation || undefined}
            correctAnswer={lastResult.correct_answer}
            userAnswer={answer}
            onNext={isSessionComplete ? () => router.push(`/results?session_id=${sessionId}`) : handleNext}
            isLastQuestion={isSessionComplete}
          />
        )}
      </AnimatePresence>

      {/* Time's Up Overlay */}
      <AnimatePresence>
        {timeUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dark/95 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="text-center"
            >
              {/* Timeout mascot with message */}
              <div className="flex justify-center mb-6">
                <MascotStage mode="quiz" timedOut />
              </div>
              <h2 className="text-4xl font-bold text-text-primary mb-2">Time&apos;s Up!</h2>
              <p className="text-text-muted mb-6">Redirecting to results...</p>
              <motion.div className="w-48 h-1 bg-surface-border rounded-full mx-auto overflow-hidden">
                <motion.div
                  className="h-full bg-brand-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2, ease: "linear" }}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Session() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="h-[80vh] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
          </div>
        }
      >
        <SessionContent />
      </Suspense>
    </AppShell>
  );
}
