"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, Loader2, ArrowRight, Upload } from "lucide-react";

import { useDocuments } from "@/hooks/useDocuments";
import { useDocumentProgressSummary } from "@/hooks/useDocumentProgress";
import { useOnboarding } from "@/hooks/useOnboarding";
import { createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { milestoneFromMastery } from "@/lib/milestones";

import { AppShell, PageContainer, Section } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Kbd } from "@/components/primitives-acx/Kbd";
import { LivePill } from "@/components/primitives-acx/LivePill";
import { StatCell } from "@/components/primitives-acx/StatCell";
import { StatusPill } from "@/components/primitives-acx/StatusPill";
import { MilestoneBadge } from "@/components/primitives-acx/MilestoneBadge";
import { SmartReviewCard } from "@/components/dashboard/SmartReviewCard";

function DashboardContent() {
  const router = useRouter();
  const { documents, isLoading, error } = useDocuments();
  const { summary } = useDocumentProgressSummary();
  const { onboarding, isLoading: onboardingLoading } = useOnboarding();

  // Redirect to onboarding if not complete
  useEffect(() => {
    if (!onboardingLoading && onboarding && !onboarding.has_completed) {
      router.replace("/onboarding");
    }
  }, [onboarding, onboardingLoading, router]);

  // Auth guard
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login");
    });
  }, [router]);

  // ⌘N → /upload
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        router.push("/upload");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const totalDocuments = documents.length;
  const readyDocuments = documents.filter((d) => d.status === "ready").length;
  const recentDocument = documents.find((d) => d.status === "ready");

  const progressDocs = summary?.documents ?? [];
  const avgMastery =
    progressDocs.length > 0
      ? progressDocs.reduce((acc, d) => acc + d.mastery_percent, 0) / progressDocs.length
      : 0;
  const sessionsTotal = progressDocs.reduce(
    (acc, d) => acc + d.concepts_practiced,
    0,
  );

  return (
    <AppShell title="Dashboard" eyebrow="Workspace">
      <PageContainer size="lg">
        {/* Hero */}
        <Section className="mt-2">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div>
              <LivePill>Welcome back</LivePill>
              <h1 className="mt-3 text-[36px] sm:text-[44px] font-medium tracking-[-0.02em] text-[var(--fg-primary)]">
                Ready to learn?
              </h1>
              <p className="mt-2 text-[15px] text-[var(--fg-secondary)] max-w-[520px]">
                Pick up where you left off, review what&apos;s due, or upload a new
                document and start a fresh session.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/upload">
                <Plus className="h-3.5 w-3.5" />
                Study new
                <Kbd className="ml-1">⌘N</Kbd>
              </Link>
            </Button>
          </div>
        </Section>

        {/* Stats */}
        <Section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCell label="Documents" value={totalDocuments} />
            <StatCell label="Ready" value={readyDocuments} />
            <StatCell label="Concepts practiced" value={sessionsTotal} />
            <StatCell
              label="Avg mastery"
              value={Math.round(avgMastery)}
              unit="%"
            />
          </div>
        </Section>

        {/* Continue learning */}
        {recentDocument && (
          <Section>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
              Continue learning
            </h2>
            <div className="flex items-center justify-between gap-4 p-4 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid place-items-center h-10 w-10 rounded-md bg-[var(--bg-elev)] border border-[var(--line-default)] shrink-0">
                  <FileText className="h-4 w-4 text-[var(--fg-secondary)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[var(--fg-primary)] truncate">
                    {recentDocument.ai_title ?? recentDocument.filename}
                  </p>
                  <p className="text-[12px] text-[var(--fg-tertiary)]">Ready to study</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/dashboard/${recentDocument.id}`}>View</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/dashboard/${recentDocument.id}`}>
                    Start
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </Section>
        )}

        {/* Smart review */}
        <Section>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
            Smart review
          </h2>
          <SmartReviewCard />
        </Section>

        {/* Documents grid */}
        <Section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
              Your documents
            </h2>
            <span className="font-mono text-[11px] tabular-nums text-[var(--fg-tertiary)]">
              {documents.length}
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-md" />
              ))}
            </div>
          ) : error ? (
            <div className="p-5 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] text-[13px] text-[var(--danger)]">
              {`Failed to load documents: ${error}`}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map((doc) => {
                const progress = progressDocs.find(
                  (p) => p.document_id === doc.id,
                );
                return (
                  <DocCard
                    key={doc.id}
                    id={doc.id}
                    title={doc.ai_title ?? doc.filename}
                    status={doc.status}
                    mastery={progress?.mastery_percent}
                  />
                );
              })}
              <Link
                href="/upload"
                className={cn(
                  "group flex flex-col items-center justify-center gap-2 p-5",
                  "min-h-[8rem] rounded-md border border-dashed border-[var(--line-default)]",
                  "text-[var(--fg-tertiary)] hover:text-[var(--fg-secondary)] hover:border-[var(--line-strong)] hover:bg-[var(--bg-surface)]",
                  "transition-colors duration-[180ms]",
                )}
              >
                <Upload className="h-4 w-4" />
                <span className="text-[13px]">Upload document</span>
              </Link>
            </div>
          )}
        </Section>
      </PageContainer>
    </AppShell>
  );
}

function DocCard({
  id,
  title,
  status,
  mastery,
}: {
  id: string;
  title: string;
  status: "pending" | "processing" | "ready" | "failed";
  mastery?: number;
}) {
  const statusVariant = status === "ready" ? "ready" : status === "failed" ? "failed" : "processing";
  return (
    <Link
      href={status === "ready" ? `/dashboard/${id}` : "#"}
      onClick={(e) => {
        if (status !== "ready") e.preventDefault();
      }}
      className={cn(
        "group relative flex flex-col p-4 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)]",
        "transition-[border-color,background-color] duration-[180ms]",
        "hover:border-[var(--line-default)] hover:bg-[var(--bg-surface)]",
        status !== "ready" && "cursor-default",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="grid place-items-center h-8 w-8 rounded-md bg-[var(--bg-elev)] border border-[var(--line-default)]">
          <FileText className="h-3.5 w-3.5 text-[var(--fg-secondary)]" />
        </div>
        <StatusPill variant={statusVariant} />
      </div>
      <p className="text-[14px] font-medium text-[var(--fg-primary)] line-clamp-2 mb-3">
        {title}
      </p>
      <div className="mt-auto">
        {mastery !== undefined ? (
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <MilestoneBadge level={milestoneFromMastery(mastery)} mastery={mastery} />
            </div>
            <div className="h-1 rounded-full bg-[var(--bg-elev)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-[240ms]"
                style={{ width: `${mastery}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--fg-tertiary)]">
            No sessions yet
          </span>
        )}
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-[var(--bg-base)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-tertiary)]" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
