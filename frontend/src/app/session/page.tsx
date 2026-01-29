"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { School, Timer, FileText, ArrowRight, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useSession, useSubmitAnswer, useCurrentQuestion } from "@/hooks/useQuiz";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";
import type { AnswerResult, InputMethod } from "@/lib/types";

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

  const { session, loading: sessionLoading, refetch } = useSession(sessionId);
  const { question, loading: questionLoading, refetch: refetchQuestion } = useCurrentQuestion(sessionId);
  const { submitAnswer, submitting, error: submitError } = useSubmitAnswer(sessionId);

  const [answer, setAnswer] = useState<string>("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);

  // Timer state - initialized lazily via function to avoid effect
  const [timeRemaining, setTimeRemaining] = useState<number | null>(() => {
    // Lazy initialization from sessionStorage
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

  // Timer countdown effect
  useEffect(() => {
    if (!timerActive || timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
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

  // Auto-navigate to results when time is up
  useEffect(() => {
    if (timeUp && sessionId) {
      const timeout = setTimeout(() => {
        router.push(`/results?session_id=${sessionId}`);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [timeUp, sessionId, router]);

  const handleSubmit = async () => {
    if (!question || !answer.trim() || timeUp) return;

    const inputMethod: InputMethod = "typed";

    try {
      const result = await submitAnswer(question.question_id, answer, inputMethod);
      setLastResult(result.result);
      setShowFeedback(true);

      if (result.session_complete) {
        // Clear timer storage when session completes
        if (sessionId) {
          sessionStorage.removeItem(`quiz_timer_start_${sessionId}`);
        }
        setTimerActive(false);
        setTimeout(() => {
          router.push(`/results?session_id=${sessionId}`);
        }, 2500);
      }
    } catch {
      // Error handled by hook
    }
  };

  const handleNext = () => {
    setShowFeedback(false);
    setAnswer("");
    setLastResult(null);
    refetchQuestion();
    refetch();
  };

  // Timer color based on remaining time
  const getTimerColor = () => {
    if (timeRemaining === null) return "text-[#f2f5de]";
    if (timeRemaining <= 10) return "text-red-400 animate-pulse";
    if (timeRemaining <= 30) return "text-[#c18c5d]";
    return "text-[#f2f5de]";
  };

  if (sessionLoading || questionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#34344a]">
        <Loader2 className="w-8 h-8 text-[#cd776a] animate-spin" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#34344a]">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
        </motion.div>
        <h2 className="text-2xl font-bold text-[#f2f5de]">Session Complete!</h2>
        <button 
          onClick={() => router.push(`/results?session_id=${sessionId}`)} 
          className="mt-4 px-6 py-3 bg-[#cd776a] text-[#34344a] rounded-lg font-semibold hover:bg-[#cd776a]/90 transition-colors"
        >
          View Results
        </button>
      </div>
    );
  }

  const progress = session ? ((session.answered_questions / session.total_questions) * 100) : 0;

  const renderQuestionInput = () => {
    if (!question) return null;

    switch (question.question_type) {
      case "mcq":
        return (
          <div className="space-y-3">
            {question.options?.map((opt, i) => (
              <button
                key={i}
                onClick={() => setAnswer(opt)}
                disabled={timeUp}
                className={`w-full text-left group flex items-center p-4 rounded-xl border-2 transition-all duration-200 ${
                  answer === opt
                    ? "border-[#cd776a] bg-[#cd776a]/20"
                    : "border-[#495867] bg-[#495867]/30 hover:border-[#cd776a]/50 hover:bg-[#495867]/50"
                } ${timeUp ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-sm transition-colors ${
                  answer === opt ? "bg-[#cd776a] text-[#34344a]" : "bg-[#34344a] text-[#f2f5de]/70 group-hover:bg-[#cd776a]/20 group-hover:text-[#cd776a]"
                }`}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="ml-4 text-base text-[#f2f5de] font-medium">{opt}</span>
              </button>
            ))}
          </div>
        );

      case "true_false":
        return (
          <div className="flex gap-4">
            {["True", "False"].map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswer(opt)}
                disabled={timeUp}
                className={`flex-1 py-5 rounded-xl border-2 text-lg font-bold transition-all duration-200 ${
                  answer === opt
                    ? "border-[#cd776a] bg-[#cd776a] text-[#34344a] shadow-lg shadow-[#cd776a]/20"
                    : "border-[#495867] bg-[#495867]/30 text-[#f2f5de] hover:border-[#cd776a]/50 hover:bg-[#495867]/50"
                } ${timeUp ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {opt}
              </button>
            ))}
          </div>
        );

      case "free_text":
        return (
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here..."
            rows={4}
            disabled={timeUp}
            className="w-full p-4 border-2 border-[#495867] bg-[#495867]/30 rounded-xl text-base text-[#f2f5de] placeholder-[#f2f5de]/40 focus:border-[#cd776a] focus:outline-none focus:bg-[#495867]/50 resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          />
        );

      default:
        return null;
    }
  };

  const getQuestionTypeLabel = () => {
    switch (question.question_type) {
      case "mcq": return "Multiple Choice";
      case "true_false": return "True or False";
      case "free_text": return "Free Response";
      default: return question.question_type;
    }
  };

  return (
    <div className="min-h-screen bg-[#34344a] text-[#f2f5de] flex flex-col font-sans">
      {/* Header */}
      <header className="w-full bg-[#495867]/30 border-b border-[#495867] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div 
              className="flex items-center gap-3 cursor-pointer" 
              onClick={() => router.push("/dashboard")}
            >
              <div className="flex items-center justify-center size-8 rounded-lg bg-[#cd776a]/20 text-[#cd776a]">
                <School size={20} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-[#f2f5de]">AutoCoach</h2>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar with Timer */}
      <div className="w-full bg-[#495867]/20 border-b border-[#495867]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3 min-w-[140px]">
              <span className="text-[#c18c5d]"><FileText size={20} /></span>
              <span className="font-medium text-[#f2f5de]">
                Question {question.question_number} of {question.total_questions}
              </span>
            </div>
            <div className="flex-1 w-full max-w-md mx-4">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-medium text-[#cd776a]">{Math.round(progress)}% Complete</span>
              </div>
              <div className="w-full bg-[#34344a] rounded-full h-2.5 border border-[#495867]">
                <motion.div 
                  className="bg-[#cd776a] h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            {initialTimerSeconds && (
              <div className={`flex items-center gap-2 bg-[#34344a] px-4 py-2 rounded-lg border border-[#495867] ${getTimerColor()}`}>
                <Timer size={18} />
                <span className="font-mono font-bold text-lg">
                  {timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-grow w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-[#495867]/20 rounded-xl shadow-lg border border-[#495867] p-6 sm:p-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#cd776a]/40 to-[#cd776a]" />

              <div className="flex mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34344a] border border-[#495867] px-3 py-1.5 text-sm font-medium text-[#c18c5d]">
                  <CheckCircle size={16} />
                  {getQuestionTypeLabel()}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-[#f2f5de] leading-tight mb-10">
                {question.question_text}
              </h1>

              {showFeedback && lastResult ? (
                <div className="space-y-6">
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-6 rounded-xl border ${
                      lastResult.is_correct 
                        ? "bg-green-500/10 border-green-500/30" 
                        : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {lastResult.is_correct ? (
                        <CheckCircle className="text-green-400" size={28} />
                      ) : (
                        <XCircle className="text-red-400" size={28} />
                      )}
                      <h3 className={`text-xl font-bold ${
                        lastResult.is_correct ? "text-green-400" : "text-red-400"
                      }`}>
                        {lastResult.is_correct ? "Correct!" : "Incorrect"}
                      </h3>
                    </div>
                    {lastResult.feedback && (
                      <p className="text-[#f2f5de]/90 mb-3">{lastResult.feedback}</p>
                    )}
                    {!lastResult.is_correct && (
                      <p className="text-sm text-[#f2f5de]/70">
                        <span className="font-medium text-[#f2f5de]">Correct answer:</span>{" "}
                        <span className="text-green-400">{lastResult.correct_answer}</span>
                      </p>
                    )}
                    {lastResult.explanation && (
                      <p className="text-sm text-[#f2f5de]/60 mt-3 italic">{lastResult.explanation}</p>
                    )}
                  </motion.div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleNext}
                      disabled={timeUp}
                      className="inline-flex items-center justify-center gap-2 rounded-lg px-8 py-3 text-base font-semibold bg-[#cd776a] text-[#34344a] hover:bg-[#cd776a]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Next Question
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {renderQuestionInput()}

                  <div className="mt-10 flex justify-end">
                    <button
                      onClick={handleSubmit}
                      disabled={!answer.trim() || submitting || timeUp}
                      className={`inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold shadow-sm transition-all w-full sm:w-auto ${
                        answer.trim() && !submitting && !timeUp
                          ? "bg-[#cd776a] text-[#34344a] hover:bg-[#cd776a]/90"
                          : "bg-[#495867]/50 text-[#f2f5de]/40 cursor-not-allowed"
                      }`}
                    >
                      {submitting ? <Loader2 className="animate-spin mr-2" size={20} /> : null}
                      {submitting ? "Submitting..." : timeUp ? "Time's Up" : "Submit Answer"}
                      {!submitting && !timeUp && <ArrowRight className="ml-2" size={20} />}
                    </button>
                  </div>
                  {submitError && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-right">
                      <span className="flex items-center justify-end gap-2">
                        <AlertCircle size={16} />
                        {getErrorMessage(submitError)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sidebar Stats */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#495867]/20 rounded-xl p-5 border border-[#495867]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f2f5de]/60 mb-3">Progress</h3>
              <p className="text-3xl font-bold text-[#cd776a]">{session?.correct_answers || 0} <span className="text-[#f2f5de]/40">/</span> {session?.answered_questions || 0}</p>
              <p className="text-sm text-[#f2f5de]/60 mt-1">Correct answers</p>
            </div>

            {initialTimerSeconds && (
              <div className="bg-[#495867]/20 rounded-xl p-5 border border-[#495867]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f2f5de]/60 mb-3">Time Remaining</h3>
                <div className={`text-3xl font-bold font-mono ${getTimerColor()}`}>
                  {timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}
                </div>
                <p className="text-sm text-[#f2f5de]/60 mt-1">
                  {timeRemaining && timeRemaining <= 30 ? "Hurry up!" : "Keep going!"}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Time's Up Overlay */}
      <AnimatePresence>
        {timeUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#34344a]/95 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="text-center"
            >
              <motion.div
                animate={{ 
                  rotate: [0, -10, 10, -10, 10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                <Timer size={80} className="text-red-400 mx-auto mb-6" />
              </motion.div>
              <h2 className="text-4xl font-bold text-[#f2f5de] mb-2">Time&apos;s Up!</h2>
              <p className="text-[#f2f5de]/60 mb-6">Redirecting to results...</p>
              <motion.div
                className="w-48 h-1 bg-[#495867] rounded-full mx-auto overflow-hidden"
              >
                <motion.div
                  className="h-full bg-[#cd776a]"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, ease: "linear" }}
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#34344a]">
        <Loader2 className="w-8 h-8 text-[#cd776a] animate-spin" />
      </div>
    }>
      <SessionContent />
    </Suspense>
  );
}
