"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import confetti from "canvas-confetti";
import {
  Loader2,
  AlertCircle,
  Home,
  RotateCcw,
  BarChart3,
  Trophy,
  Sparkles,
  Target,
} from "lucide-react";
import { useSession } from "@/hooks/useQuiz";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";
import { AppShell, PageContainer, Section } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { ScoreCircle, InlineStats } from "@/components/results/ScoreCircle";
import { ReviewAccordion } from "@/components/results/ReviewRow";
import { MascotStage } from "@/components/brand/MascotStage";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resultsStaggerContainer, slideUpItem } from "@/lib/motions";

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { session, loading, error: sessionError } = useSession(sessionId);
  const confettiFired = useRef(false);

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

  // Derived data — computed early so confetti effect can use scorePercent
  const questions = session?.questions ?? [];
  const hasQuestions = questions.length > 0;

  const toSafeNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const coerced = Number(value);
      return Number.isFinite(coerced) ? coerced : 0;
    }
    return 0;
  };

  const correctFromQuestions = questions.filter((q) => q.is_correct === true).length;
  const answeredFromQuestions = questions.filter((q) => q.user_answer != null).length;
  const sessionTotal = toSafeNumber(session?.total_questions);
  const sessionCorrect = toSafeNumber(session?.correct_answers);

  const total = hasQuestions ? questions.length : sessionTotal;
  const correct = hasQuestions ? correctFromQuestions : sessionCorrect;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const hasAnyAnswers = total > 0;

  // Confetti on high scores
  useEffect(() => {
    if (scorePercent >= 80 && hasAnyAnswers && !confettiFired.current) {
      confettiFired.current = true;
      const timer = setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#cd776a", "#c18c5d", "#22c55e", "#eab308"],
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [scorePercent, hasAnyAnswers]);

  // Filtered question lists for tabs
  const reviewItems = useMemo(
    () =>
      questions.map((q, index) => ({
        question_id: q.question_id,
        question_number: index + 1,
        question_text: q.question_text,
        question_type: q.question_type,
        user_answer: q.user_answer || "",
        correct_answer: q.correct_answer,
        is_correct: q.is_correct ?? false,
        explanation: q.explanation || undefined,
      })),
    [questions]
  );

  const correctItems = useMemo(
    () => reviewItems.filter((q) => q.is_correct),
    [reviewItems]
  );
  const wrongItems = useMemo(
    () => reviewItems.filter((q) => !q.is_correct),
    [reviewItems]
  );

  if (loading) {
    return (
      <PageContainer size="xl">
        <div className="py-8">
          <Section spacing="sm">
            <div className="rounded-3xl bg-[var(--surface-card)] border border-[var(--surface-border)] p-8 md:p-12">
              <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <Skeleton className="w-40 h-40 rounded-full shrink-0" />
                <div className="flex-1 text-center md:text-left w-full">
                  <Skeleton className="h-10 w-48 mb-4 mx-auto md:mx-0" />
                  <Skeleton className="h-8 w-32 rounded-full mb-6 mx-auto md:mx-0" />
                  <Skeleton className="h-6 w-56 mb-2 mx-auto md:mx-0" />
                  <Skeleton className="h-2.5 w-64 rounded-full mx-auto md:mx-0" />
                </div>
              </div>
            </div>
          </Section>
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
            className="mb-4 p-4 rounded-xl bg-[var(--semantic-error)]/10 border border-[var(--semantic-error)]/30 text-[var(--semantic-error)] max-w-md text-center"
          >
            <AlertCircle className="inline-block mr-2" size={20} />
            {displayError}
          </motion.div>
        )}
        <p className="text-[var(--text-muted)]">Session not found</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const getPerformanceMessage = () => {
    if (scorePercent >= 80) return { message: "Outstanding!", color: "#22c55e", icon: Trophy };
    if (scorePercent >= 60) return { message: "Great job!", color: "#c18c5d", icon: Sparkles };
    if (scorePercent >= 40) return { message: "Good effort!", color: "#eab308", icon: Target };
    return { message: "Keep practicing!", color: "#ef4444", icon: BarChart3 };
  };

  const performance = getPerformanceMessage();
  const PerformanceIcon = performance.icon;

  return (
    <PageContainer size="xl">
      <motion.div
        variants={resultsStaggerContainer}
        initial="hidden"
        animate="show"
        className="py-8"
      >
        {/* Hero Score Card */}
        <Section spacing="sm">
          <motion.div
            variants={slideUpItem}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--surface-card)] to-[var(--surface-darker)] border border-[var(--surface-border)] p-8 md:p-12"
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand-primary)]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--brand-secondary)]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* Left: Score Circle */}
              <div className="shrink-0">
                {hasAnyAnswers ? (
                  <ScoreCircle
                    score={scorePercent}
                    total={100}
                    size="lg"
                  />
                ) : (
                  <div className="relative w-64 h-64 flex items-center justify-center rounded-full bg-[var(--surface-card)] border border-[var(--surface-border)]">
                    <span className="text-sm text-[var(--text-muted)] uppercase tracking-wider text-center px-6">
                      No answers recorded
                    </span>
                  </div>
                )}
              </div>

              {/* Right: Mascot + badge + InlineStats */}
              <div className="flex-1 text-center md:text-left">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="mb-4">
                    <MascotStage mode="results" scorePercent={scorePercent} />
                  </div>
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
                    style={{
                      backgroundColor: `${performance.color}20`,
                      color: performance.color,
                    }}
                  >
                    <PerformanceIcon size={18} />
                    {performance.message}
                  </div>
                </motion.div>

                {/* InlineStats replaces ScoreBreakdown */}
                <InlineStats correct={correct} total={total} />
              </div>
            </div>

            {/* Action buttons inside hero card */}
            <Separator className="my-8 bg-[var(--surface-border)]/50" />

            <motion.div
              variants={slideUpItem}
              className="relative flex flex-col sm:flex-row gap-4"
            >
              <Button
                variant="outline"
                asChild
                className="flex-1"
              >
                <Link href="/dashboard">
                  <Home size={20} className="mr-2" />
                  Dashboard
                </Link>
              </Button>

              <Button
                asChild
                className="flex-1 shadow-lg shadow-[var(--brand-primary)]/20"
              >
                <Link href={`/config?document_id=${session.document_id}`}>
                  <RotateCcw size={20} className="mr-2" />
                  Try Again
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </Section>

        {/* Question Review with Tabs */}
        <Section>
          <motion.div variants={slideUpItem}>
            <h2 className="text-xl font-heading font-semibold text-[var(--text-primary)] mb-1">
              Question Review
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Review your answers and learn from mistakes
            </p>

            <Tabs defaultValue="all">
              <TabsList className="mb-4 bg-[var(--surface-darker)] border border-[var(--surface-border)]">
                <TabsTrigger value="all">
                  All ({reviewItems.length})
                </TabsTrigger>
                <TabsTrigger value="correct">
                  Correct ({correctItems.length})
                </TabsTrigger>
                <TabsTrigger value="wrong">
                  Wrong ({wrongItems.length})
                </TabsTrigger>
              </TabsList>

              <div className="rounded-2xl border border-[var(--surface-border)] overflow-hidden bg-[var(--surface-card)]">
                <TabsContent value="all" className="mt-0">
                  {reviewItems.length > 0 ? (
                    <ReviewAccordion items={reviewItems} />
                  ) : (
                    <p className="p-8 text-center text-[var(--text-muted)]">
                      No questions to review.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="correct" className="mt-0">
                  {correctItems.length > 0 ? (
                    <ReviewAccordion items={correctItems} />
                  ) : (
                    <p className="p-8 text-center text-[var(--text-muted)]">
                      No correct answers yet.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="wrong" className="mt-0">
                  {wrongItems.length > 0 ? (
                    <ReviewAccordion items={wrongItems} />
                  ) : (
                    <p className="p-8 text-center text-[var(--text-muted)]">
                      No wrong answers — perfect score!
                    </p>
                  )}
                </TabsContent>
              </div>
            </Tabs>
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
