"use client";

import { Suspense, useEffect } from "react";
import { motion, Variants } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  School, 
  CheckCircle, 
  XCircle, 
  Trophy, 
  Loader2, 
  AlertCircle,
  Target,
  Clock,
  RotateCcw,
  Home,
  ChevronRight
} from "lucide-react";
import { useSession } from "@/hooks/useQuiz";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { session, loading, error: sessionError } = useSession(sessionId);
  
  const displayError = sessionError ? getErrorMessage(sessionError) : null;

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#34344a]">
        <Loader2 className="w-8 h-8 text-[#cd776a] animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#34344a] px-4">
        {displayError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 max-w-md text-center"
          >
            <AlertCircle className="inline-block mr-2" size={20} />
            {displayError}
          </motion.div>
        )}
        <p className="text-[#f2f5de]/60">Session not found</p>
        <Link 
          href="/dashboard" 
          className="mt-4 px-6 py-2 rounded-lg bg-[#cd776a] text-[#34344a] font-semibold hover:bg-[#cd776a]/90 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const score = session.score_percentage || 0;
  const correct = session.correct_answers;
  const total = session.total_questions;
  const incorrect = total - correct;

  // Determine performance message and color
  const getPerformance = () => {
    if (score >= 80) return { 
      message: "Outstanding! 🎉", 
      color: "#4ade80",
      bgColor: "rgba(74, 222, 128, 0.1)"
    };
    if (score >= 60) return { 
      message: "Great job! 👏", 
      color: "#cd776a",
      bgColor: "rgba(205, 119, 106, 0.1)"
    };
    if (score >= 40) return { 
      message: "Good effort! 💪", 
      color: "#c18c5d",
      bgColor: "rgba(193, 140, 93, 0.1)"
    };
    return { 
      message: "Keep practicing! 📚", 
      color: "#f87171",
      bgColor: "rgba(248, 113, 113, 0.1)"
    };
  };

  const performance = getPerformance();

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "mcq": return "Multiple Choice";
      case "true_false": return "True/False";
      case "free_text": return "Free Response";
      default: return type;
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "mcq": return "🔘";
      case "true_false": return "✓";
      case "free_text": return "✏️";
      default: return "❓";
    }
  };

  return (
    <div className="min-h-screen bg-[#34344a] text-[#f2f5de] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#34344a]/90 border-b border-[#495867]/50 px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => router.push("/dashboard")}
          >
            <div className="size-8 rounded-lg bg-[#cd776a]/20 text-[#cd776a] flex items-center justify-center">
              <School size={20} />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-[#f2f5de]">AutoCoach</h2>
          </div>
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[#f2f5de]/70 hover:text-[#f2f5de] hover:bg-[#495867]/50 transition-all"
          >
            <Home size={18} />
            <span className="hidden sm:inline text-sm font-medium">Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="w-full max-w-[1200px] mx-auto px-4 py-8 md:px-6 md:py-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-8"
        >
          {/* Hero Score Section */}
          <motion.section 
            variants={itemVariants}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#495867]/50 to-[#34344a] border border-[#495867] p-8 md:p-12"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#cd776a]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#c18c5d]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* Score Circle */}
              <div className="relative shrink-0">
                <div className="relative size-40 md:size-48">
                  <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <path 
                      className="text-[#495867]" 
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="3" 
                    />
                    {/* Score progress */}
                    <motion.path
                      initial={{ strokeDasharray: "0, 100" }}
                      animate={{ strokeDasharray: `${score}, 100` }}
                      transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
                      className="text-[#cd776a]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.8 }}
                      className="text-4xl md:text-5xl font-extrabold text-[#f2f5de] tracking-tighter"
                    >
                      {Math.round(score)}%
                    </motion.span>
                    <span className="text-[#f2f5de]/50 text-sm font-medium mt-1">Score</span>
                  </div>
                </div>
                
                {/* Floating trophy for high scores */}
                {score >= 80 && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, delay: 1.2 }}
                    className="absolute -top-2 -right-2 size-12 bg-[#c18c5d] rounded-full flex items-center justify-center shadow-lg shadow-[#c18c5d]/30"
                  >
                    <Trophy size={24} className="text-[#34344a]" />
                  </motion.div>
                )}
              </div>

              {/* Score Details */}
              <div className="flex-1 text-center md:text-left">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <h1 className="text-3xl md:text-4xl font-bold text-[#f2f5de] mb-2">
                    Quiz Complete!
                  </h1>
                  <div 
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6"
                    style={{ 
                      backgroundColor: performance.bgColor,
                      color: performance.color
                    }}
                  >
                    {performance.message}
                  </div>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto md:mx-0">
                  <motion.div
                    variants={itemVariants}
                    className="bg-[#34344a]/50 rounded-2xl p-4 border border-[#495867]/50"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-500/20 text-green-400 mx-auto mb-2">
                      <CheckCircle size={20} />
                    </div>
                    <p className="text-2xl font-bold text-[#f2f5de]">{correct}</p>
                    <p className="text-xs text-[#f2f5de]/50 uppercase tracking-wider font-medium">Correct</p>
                  </motion.div>

                  <motion.div
                    variants={itemVariants}
                    className="bg-[#34344a]/50 rounded-2xl p-4 border border-[#495867]/50"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/20 text-red-400 mx-auto mb-2">
                      <XCircle size={20} />
                    </div>
                    <p className="text-2xl font-bold text-[#f2f5de]">{incorrect}</p>
                    <p className="text-xs text-[#f2f5de]/50 uppercase tracking-wider font-medium">Wrong</p>
                  </motion.div>

                  <motion.div
                    variants={itemVariants}
                    className="bg-[#34344a]/50 rounded-2xl p-4 border border-[#495867]/50"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#cd776a]/20 text-[#cd776a] mx-auto mb-2">
                      <Target size={20} />
                    </div>
                    <p className="text-2xl font-bold text-[#f2f5de]">{total}</p>
                    <p className="text-xs text-[#f2f5de]/50 uppercase tracking-wider font-medium">Total</p>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Question Breakdown */}
          <motion.section variants={itemVariants}>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-xl bg-[#495867] flex items-center justify-center">
                <Clock size={20} className="text-[#cd776a]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#f2f5de]">Question Breakdown</h2>
                <p className="text-sm text-[#f2f5de]/50">Review your answers</p>
              </div>
            </div>

            <div className="bg-[#495867]/20 rounded-2xl border border-[#495867]/50 overflow-hidden">
              {session.questions.map((q, index) => (
                <motion.div
                  key={q.question_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className={`p-4 md:p-6 ${index !== session.questions.length - 1 ? 'border-b border-[#495867]/50' : ''}`}
                >
                  <div className="flex gap-4">
                    {/* Question Number & Status */}
                    <div className="shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        q.is_correct 
                          ? "bg-green-500/20 text-green-400" 
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {q.is_correct ? (
                          <CheckCircle size={18} />
                        ) : (
                          <XCircle size={18} />
                        )}
                      </div>
                    </div>

                    {/* Question Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-[#f2f5de]/40 uppercase">Q{index + 1}</span>
                        <span className="text-xs px-2 py-1 rounded-lg bg-[#34344a] text-[#f2f5de]/60 border border-[#495867]/50">
                          {getQuestionTypeIcon(q.question_type)} {getQuestionTypeLabel(q.question_type)}
                        </span>
                      </div>
                      
                      <p className="font-medium text-[#f2f5de] mb-3 leading-relaxed">
                        {q.question_text}
                      </p>

                      {/* Answer Comparison */}
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-semibold text-[#f2f5de]/40 uppercase w-20 shrink-0 pt-1">
                            You:
                          </span>
                          <span className={`text-sm font-medium ${
                            q.is_correct ? "text-green-400" : "text-red-400"
                          }`}>
                            {q.user_answer || "Not answered"}
                          </span>
                        </div>
                        
                        {!q.is_correct && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-[#f2f5de]/40 uppercase w-20 shrink-0 pt-1">
                              Correct:
                            </span>
                            <span className="text-sm font-medium text-green-400">
                              {q.correct_answer}
                            </span>
                          </div>
                        )}
                      </div>

                      {q.explanation && (
                        <div className="mt-3 p-3 rounded-xl bg-[#34344a]/50 border border-[#495867]/30">
                          <p className="text-sm text-[#f2f5de]/60 italic">
                            <span className="font-medium text-[#c18c5d] not-italic">Note: </span>
                            {q.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Action Buttons */}
          <motion.section 
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 sticky bottom-6 z-40"
          >
            <Link 
              href="/dashboard" 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 rounded-xl border-2 border-[#495867] text-[#f2f5de] font-semibold hover:bg-[#495867]/30 transition-all"
            >
              <Home size={20} />
              Dashboard
            </Link>
            
            <Link 
              href={`/config?document_id=${session.document_id}`} 
              className="flex-1 sm:flex-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#cd776a] text-[#34344a] font-bold shadow-lg shadow-[#cd776a]/20 hover:bg-[#cd776a]/90 hover:shadow-[#cd776a]/30 transition-all"
            >
              <RotateCcw size={20} />
              Try Again
            </Link>

            {score < 100 && (
              <Link 
                href={`/session?session_id=${sessionId}`}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#495867] text-[#f2f5de] font-semibold hover:bg-[#495867]/80 transition-all"
              >
                Review
                <ChevronRight size={20} />
              </Link>
            )}
          </motion.section>
        </motion.div>
      </main>
    </div>
  );
}

export default function Results() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#34344a]">
        <Loader2 className="w-8 h-8 text-[#cd776a] animate-spin" />
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
