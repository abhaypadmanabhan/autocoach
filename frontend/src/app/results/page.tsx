"use client";

import { Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  Home,
  RotateCcw,
  Clock,
  Target,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { useSession } from "@/hooks/useQuiz";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";
import { AppShell, PageContainer, Section } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { ScoreCircle, ScoreBreakdown, StatSatellite } from "@/components/results/ScoreCircle";
import { ReviewList } from "@/components/results/ReviewRow";
import { MascotStage } from "@/components/brand/MascotStage";
import { staggerContainer, slideUpItem, cardLiftVariants } from "@/lib/motions";

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
      <PageContainer size="xl">
        <div className="py-8">
          {/* Skeleton Hero */}
          <Section spacing="sm">
            <div className="rounded-3xl bg-surface-card border border-surface-border p-8 md:p-12">
              <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                {/* Score Circle Skeleton */}
                <Skeleton className="w-40 h-40 rounded-full shrink-0" />
                {/* Details Skeleton */}
                <div className="flex-1 text-center md:text-left w-full">
                  <Skeleton className="h-10 w-48 mb-4 mx-auto md:mx-0" />
                  <Skeleton className="h-8 w-32 rounded-full mb-6 mx-auto md:mx-0" />
                  <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          </Section>
          {/* Skeleton Review */}
          <Section>
            <Skeleton className="h-8 w-40 mb-6" />
            <div className="space-y-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </Section>
        </div>
      </PageContainer>
    );
  }

  if (!session) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center px-4">
        {displayError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-xl bg-semantic-error/10 border border-semantic-error/30 text-semantic-error max-w-md text-center"
          >
            <AlertCircle className="inline-block mr-2" size={20} />
            {displayError}
          </motion.div>
        )}
        <p className="text-text-muted">Session not found</p>
        <Link
          href="/dashboard"
          className="mt-4 px-6 py-3 rounded-xl bg-brand-primary text-surface-dark font-semibold hover:bg-brand-primary/90 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const toSafeNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const coerced = Number(value);
      return Number.isFinite(coerced) ? coerced : 0;
    }
    return 0;
  };

  const questions = session.questions ?? [];
  const hasQuestions = questions.length > 0;
  const correctFromQuestions = questions.filter((q) => q.is_correct === true).length;
  const answeredFromQuestions = questions.filter((q) => q.user_answer != null).length;
  const sessionTotal = toSafeNumber(session.total_questions);
  const sessionCorrect = toSafeNumber(session.correct_answers);

  const total = hasQuestions ? questions.length : sessionTotal;
  const correct = hasQuestions ? correctFromQuestions : sessionCorrect;
  const answered = hasQuestions ? answeredFromQuestions : sessionTotal;
  const incorrect = Math.max(total - correct, 0);

  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const accuracyPercent = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const hasAnyAnswers = total > 0;

  const getPerformanceMessage = () => {
    if (scorePercent >= 80) return { message: "Outstanding! 🎉", color: "#22c55e" };
    if (scorePercent >= 60) return { message: "Great job! 👏", color: "#c18c5d" };
    if (scorePercent >= 40) return { message: "Good effort! 💪", color: "#eab308" };
    return { message: "Keep practicing! 📚", color: "#ef4444" };
  };

  const performance = getPerformanceMessage();

  return (
    <PageContainer size="xl">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="py-8"
      >
        {/* Hero Score Section */}
        <Section spacing="sm">
          <motion.div
            variants={slideUpItem}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-card to-surface-dark border border-surface-border p-8 md:p-12"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-secondary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* Score Circle */}
              <div className="shrink-0">
                {hasAnyAnswers ? (
                  <ScoreCircle
                    score={scorePercent}
                    total={100}
                    size="lg"
                  />
                ) : (
                  <div className="relative w-64 h-64 flex items-center justify-center rounded-full bg-surface-card border border-surface-border">
                    <span className="text-sm text-text-muted uppercase tracking-wider text-center px-6">
                      No answers recorded
                    </span>
                  </div>
                )}
              </div>

              {/* Score Details */}
              <div className="flex-1 text-center md:text-left">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="mb-2">
                    <MascotStage mode="results" scorePercent={scorePercent} />
                  </div>
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6"
                    style={{
                      backgroundColor: `${performance.color}20`,
                      color: performance.color,
                    }}
                  >
                    {performance.message}
                  </div>
                </motion.div>

                {/* Stats Grid */}
                <ScoreBreakdown
                  correct={correct}
                  incorrect={incorrect}
                  total={total}
                />
              </div>
            </div>

            {/* Satellite Stats */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-3 gap-4 mt-8 max-w-md mx-auto"
            >
              <StatSatellite
                icon={<Clock size={20} />}
                label="Time"
                value="--:--"
                orbitDelay={1}
              />
              <StatSatellite
                icon={<Target size={20} />}
                label="Accuracy"
                value={hasAnyAnswers ? `${accuracyPercent}%` : "No answers recorded"}
                orbitDelay={2}
              />
              <StatSatellite
                icon={<BarChart3 size={20} />}
                label="Questions"
                value={total}
                orbitDelay={3}
              />
            </motion.div>
          </motion.div>
        </Section>

        {/* Question Review */}
        <Section>
          <motion.div variants={slideUpItem}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-surface-card border border-surface-border flex items-center justify-center">
                <BarChart3 size={20} className="text-brand-primary" />
              </div>
              <div>
                <h2 className="text-h2 font-serif text-text-primary">Question Review</h2>
                <p className="text-sm text-text-muted">Review your answers</p>
              </div>
            </div>

            <ReviewList items={session.questions.map((q, index) => ({
              question_id: q.question_id,
              question_number: index + 1,
              question_text: q.question_text,
              question_type: q.question_type,
              user_answer: q.user_answer || "",
              correct_answer: q.correct_answer,
              is_correct: q.is_correct ?? false,
              explanation: q.explanation || undefined,
            }))} />
          </motion.div>
        </Section>

        {/* Action Buttons */}
        <Section spacing="sm">
          <motion.div
            variants={slideUpItem}
            className="flex flex-col sm:flex-row gap-4 sticky bottom-6"
          >
            <Link
              href="/dashboard"
              className="
                flex-1 sm:flex-none flex items-center justify-center gap-2
                px-8 py-4 rounded-xl
                border-2 border-surface-border text-text-primary
                font-semibold hover:bg-surface-card transition-colors
              "
            >
              <Home size={20} />
              Dashboard
            </Link>

            <Link
              href={`/config?document_id=${session.document_id}`}
              className="
                flex-1 sm:flex-auto flex items-center justify-center gap-2
                px-8 py-4 rounded-xl
                bg-brand-primary text-surface-dark
                font-bold shadow-lg shadow-brand-primary/20
                hover:bg-brand-primary/90 hover:shadow-brand-primary/30
                transition-all
              "
            >
              <RotateCcw size={20} />
              Try Again
            </Link>

            {scorePercent < 100 && (
              <Link
                href={`/session?session_id=${sessionId}`}
                className="
                  flex-1 sm:flex-none flex items-center justify-center gap-2
                  px-8 py-4 rounded-xl
                  bg-surface-card text-text-primary
                  font-semibold hover:bg-surface-border/50
                  transition-colors
                "
              >
                Review
                <ChevronRight size={20} />
              </Link>
            )}
          </motion.div>
        </Section>
      </motion.div>
    </PageContainer>
  );
}

export default function Results() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="h-[80vh] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
          </div>
        }
      >
        <ResultsContent />
      </Suspense>
    </AppShell>
  );
}
