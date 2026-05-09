"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { useSession } from "@/hooks/useQuiz";
import { useDocument } from "@/hooks/useDocuments";
import { createBrowserClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

import {
  AppShell,
  PageContainer,
  Section,
} from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/primitives-acx/ScoreGauge";
import { Confetti } from "@/components/primitives-acx/Confetti";
import { WhyInset } from "@/components/primitives-acx/WhyInset";

type Grade = {
  label: string;
  variant: "success" | "accent" | "warning" | "danger";
};

function gradeFor(score: number): Grade {
  if (score >= 85) return { label: "Strong", variant: "success" };
  if (score >= 70) return { label: "Solid pass", variant: "accent" };
  if (score >= 50) return { label: "Almost there", variant: "warning" };
  return { label: "Needs work", variant: "danger" };
}

function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? searchParams.get("id");

  const { session, loading, error: sessionError } = useSession(sessionId);
  const { document } = useDocument(session?.document_id ?? null);
  const completionTracked = useRef<Set<string>>(new Set());

  // Auth guard
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) router.replace("/login");
    });
  }, [router]);

  useEffect(() => {
    if (!sessionId) router.replace("/dashboard");
  }, [sessionId, router]);

  const questions = useMemo(() => session?.questions ?? [], [session?.questions]);
  const total = questions.length || (session?.total_questions ?? 0);
  const correct =
    questions.length > 0
      ? questions.filter((q) => q.is_correct === true).length
      : (session?.correct_answers ?? 0);
  const wrong = total - correct;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const grade = gradeFor(scorePercent);

  const perQuestion = useMemo(
    () => questions.map((q) => q.is_correct === true),
    [questions],
  );

  // Track completed event once
  useEffect(() => {
    if (
      total > 0 &&
      session?.status === "completed" &&
      sessionId &&
      !completionTracked.current.has(sessionId)
    ) {
      analytics.capture("quiz_session_completed", {
        session_id: sessionId,
        score_percent: scorePercent,
        total_questions: total,
        correct_answers: correct,
      });
      completionTracked.current.add(sessionId);
    }
  }, [scorePercent, total, correct, session?.status, sessionId]);

  if (loading) {
    return (
      <AppShell title="Results" eyebrow="Session" showBack backHref="/dashboard">
        <PageContainer size="lg">
          <Section className="mt-2">
            <div className="flex flex-col items-center gap-4 py-8">
              <Skeleton className="h-32 w-72 rounded-md" />
              <Skeleton className="h-6 w-40 rounded-full" />
            </div>
          </Section>
        </PageContainer>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell title="Results" eyebrow="Session" showBack backHref="/dashboard">
        <PageContainer size="lg">
          <Section className="mt-2">
            <div className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] p-6 text-center">
              <p className="text-[14px] text-[var(--danger)] mb-3">
                {sessionError ? getErrorMessage(sessionError) : "Session not found"}
              </p>
              <Button asChild variant="secondary">
                <Link href="/dashboard">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to dashboard
                </Link>
              </Button>
            </div>
          </Section>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={document?.ai_title ?? document?.filename ?? "Session"}
      eyebrow="Results"
      showBack
      backHref="/dashboard"
    >
      <Confetti score={scorePercent} />
      <PageContainer size="lg">
        {/* Hero score */}
        <Section className="mt-2">
          <div className="flex flex-col items-center text-center">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)] mb-3">
              Final score
            </span>
            <ScoreGauge score={scorePercent} perQuestion={perQuestion} size="lg" />
            <Badge variant={grade.variant} className="mt-4">
              {grade.label}
            </Badge>
          </div>
        </Section>

        {/* Ledger */}
        <Section>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-[var(--line-subtle)] border border-[var(--line-subtle)] rounded-md overflow-hidden">
            <Stat label="Correct" value={correct} />
            <Stat label="Wrong" value={wrong} />
            <Stat label="Total" value={total} />
            <Stat label="Accuracy" value={`${scorePercent}%`} />
            <Stat label="XP" value={`+${correct * 10}`} accent />
          </div>
        </Section>

        {/* Action buttons */}
        <Section>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button asChild size="lg">
              <Link href={`/dashboard/${session.document_id}`}>
                <RotateCcw className="h-3.5 w-3.5" />
                Try again
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href={`/dashboard/${session.document_id}`}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to document
              </Link>
            </Button>
          </div>
        </Section>

        {/* Review */}
        {questions.length > 0 && (
          <Section>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)] mb-4">
              Review
            </h2>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all" count={total}>
                  All
                </TabsTrigger>
                <TabsTrigger value="correct" count={correct}>
                  Correct
                </TabsTrigger>
                <TabsTrigger value="wrong" count={wrong}>
                  Wrong
                </TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <ReviewList items={questions} />
              </TabsContent>
              <TabsContent value="correct">
                <ReviewList items={questions.filter((q) => q.is_correct)} />
              </TabsContent>
              <TabsContent value="wrong">
                <ReviewList items={questions.filter((q) => !q.is_correct)} />
              </TabsContent>
            </Tabs>
          </Section>
        )}
      </PageContainer>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="bg-[var(--bg-base)] p-4 flex flex-col gap-1">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[24px] tabular-nums tracking-[-0.02em]",
          accent ? "text-[var(--accent)]" : "text-[var(--fg-primary)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

type ReviewItem = {
  question_id: string;
  question_number: number;
  question_text: string;
  user_answer: string | null;
  correct_answer: string;
  is_correct: boolean | null;
  explanation?: string | null;
};

function ReviewList({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) {
    return (
      <div className="p-8 rounded-md border border-dashed border-[var(--line-default)] text-center text-[13px] text-[var(--fg-tertiary)]">
        No questions in this view.
      </div>
    );
  }
  return (
    <div className="divide-y divide-[var(--line-subtle)] border border-[var(--line-subtle)] rounded-md overflow-hidden">
      {items.map((q) => (
        <ReviewRow key={q.question_id} q={q} />
      ))}
    </div>
  );
}

function ReviewRow({ q }: { q: ReviewItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-[var(--bg-surface)]"
      >
        <span
          className={cn(
            "shrink-0 grid place-items-center h-6 w-6 rounded-sm",
            q.is_correct
              ? "bg-[color-mix(in_oklab,var(--success)_15%,var(--bg-elev))] text-[var(--success)]"
              : "bg-[color-mix(in_oklab,var(--danger)_15%,var(--bg-elev))] text-[var(--danger)]",
          )}
        >
          {q.is_correct ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[11px] tabular-nums text-[var(--fg-tertiary)]">
              Q{String(q.question_number).padStart(2, "0")}
            </span>
            <span className="text-[14px] text-[var(--fg-primary)] truncate">
              {q.question_text}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--fg-tertiary)] transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 space-y-3 anim-step-in">
          {q.user_answer && (
            <div>
              <span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)] mb-1">
                You said
              </span>
              <p
                className={cn(
                  "text-[13px]",
                  q.is_correct
                    ? "text-[var(--fg-secondary)]"
                    : "text-[var(--fg-secondary)] line-through decoration-[var(--line-default)]",
                )}
              >
                {q.user_answer}
              </p>
            </div>
          )}
          <div>
            <span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)] mb-1">
              Correct answer
            </span>
            <p className="text-[13px] font-medium text-[var(--fg-primary)]">
              {q.correct_answer}
            </p>
          </div>
          {q.explanation && <WhyInset>{q.explanation}</WhyInset>}
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-[var(--bg-base)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-tertiary)]" />
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
