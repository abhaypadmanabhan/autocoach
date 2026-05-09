"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  PlayCircle,
  RefreshCw,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";

import { useDocument } from "@/hooks/useDocuments";
import { useDocumentConcepts } from "@/hooks/useConcepts";
import { useDocumentProgress } from "@/hooks/useDocumentProgress";
import { useCreateSession } from "@/hooks/useQuiz";
import { useToast } from "@/hooks/useToast";
import { ApiError } from "@/lib/types";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

import { AppShell, PageContainer, Section } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/Skeleton";
import { MilestoneBadge } from "@/components/primitives-acx/MilestoneBadge";
import { ImportanceDots } from "@/components/primitives-acx/ImportanceDots";
import { CoreBadge } from "@/components/primitives-acx/CoreBadge";

type SortKey = "name" | "importance" | "mastery";

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function formatRelative(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}D ago`;
  if (days < 30) return `${Math.floor(days / 7)}W ago`;
  return `${Math.floor(days / 30)}M ago`;
}

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: documentId } = use(params);
  const router = useRouter();
  const { document, isLoading: docLoading, error: docError } = useDocument(documentId);
  const { concepts, isLoading: conceptsLoading } = useDocumentConcepts(documentId);
  const { progress } = useDocumentProgress(documentId);
  const { createSession, creating } = useCreateSession();
  const { showToast } = useToast();
  const [sortKey, setSortKey] = useState<SortKey>("importance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (docError) {
      const message =
        docError instanceof ApiError ? docError.message : "Failed to load document";
      showToast(message, "error");
    }
  }, [docError, showToast]);

  const sortedConcepts = useMemo(() => {
    const arr = [...concepts];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.concept_name.localeCompare(b.concept_name);
      else if (sortKey === "importance") cmp = a.importance_score - b.importance_score;
      else if (sortKey === "mastery") cmp = a.mastery_score - b.mastery_score;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [concepts, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const handleStartQuiz = async (focusIds?: string[]) => {
    if (!document) return;
    try {
      const session = await createSession({
        document_id: document.id,
        num_questions: focusIds && focusIds.length ? Math.max(5, focusIds.length) : 10,
        difficulty: "medium",
        question_types: ["text_mcq", "text_tf", "text_free"],
        focus_concept_ids: focusIds,
      });
      analytics.capture("session_started", {
        session_id: session.session_id,
        document_id: document.id,
      });
      router.push(`/session?id=${session.session_id}`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to start session";
      showToast(message, "error");
    }
  };

  const mastery = progress?.mastery_percent ?? 0;
  const weakConcepts = sortedConcepts.filter((c) => c.mastery_score < 50);

  return (
    <AppShell
      eyebrow="Document"
      title={document?.ai_title ?? document?.filename ?? "Loading"}
      showBack
      backHref="/dashboard"
    >
      <PageContainer size="lg">
        {/* Hero */}
        <Section className="mt-2">
          {docLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : document ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-[12px] font-mono uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
                <span>{document.file_type?.replace(/^application\//, "").toUpperCase() || "DOC"}</span>
                <span className="text-[var(--fg-disabled)]">·</span>
                <span>{formatBytes(document.file_size)}</span>
                <span className="text-[var(--fg-disabled)]">·</span>
                <span>Uploaded {formatRelative(document.created_at)}</span>
              </div>
              <h1 className="text-[40px] sm:text-[56px] font-medium tracking-[-0.02em] text-[var(--fg-primary)] leading-[1.1]">
                {document.ai_title ?? document.filename}
              </h1>
              <div className="flex items-center gap-3 pt-1">
                <MilestoneBadge mastery={mastery} />
                <span className="text-[13px] text-[var(--fg-secondary)]">
                  {progress?.concepts_total ?? concepts.length} concepts ·{" "}
                  {progress?.concepts_practiced ?? 0} practiced ·{" "}
                  {progress?.weak_concepts_count ?? weakConcepts.length} weak
                </span>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] text-[var(--danger)] flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-[13px]">Document not found.</p>
            </div>
          )}
        </Section>

        {/* CTA */}
        {document?.status === "ready" && (
          <Section>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="xl"
                onClick={() => handleStartQuiz()}
                disabled={creating}
                className="flex-1 justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Start session
                </span>
                <span className="font-mono text-[11px] text-white/70">10 questions</span>
              </Button>
              <Button
                variant="secondary"
                size="xl"
                disabled={creating || weakConcepts.length === 0}
                onClick={() =>
                  handleStartQuiz(weakConcepts.slice(0, 5).map((c) => c.id))
                }
                className="flex-1 justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Review weak concepts
                </span>
                <span className="font-mono text-[11px] text-[var(--fg-tertiary)]">
                  {Math.min(5, weakConcepts.length)} concepts
                </span>
              </Button>
            </div>
          </Section>
        )}

        {document?.status === "processing" && (
          <Section>
            <div className="p-5 rounded-md border border-[color-mix(in_oklab,var(--warning)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--warning)_8%,var(--bg-elev))] flex items-center gap-3">
              <Loader2 className="h-4 w-4 text-[var(--warning)] animate-spin" />
              <p className="text-[13px] text-[var(--warning)]">
                Document is processing. Concepts will appear when ready.
              </p>
            </div>
          </Section>
        )}

        {document?.status === "failed" && (
          <Section>
            <div className="p-5 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,var(--line-default))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-elev))] flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-[var(--danger)] mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] font-medium text-[var(--danger)]">
                  Processing failed
                </p>
                <p className="text-[13px] text-[var(--fg-secondary)] mt-1">
                  {document.error_message ?? "An error occurred while processing this document."}
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href="/upload">Re-upload</Link>
              </Button>
            </div>
          </Section>
        )}

        {/* Concepts */}
        <Section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
              Concepts
            </h2>
            <span className="font-mono text-[11px] tabular-nums text-[var(--fg-tertiary)]">
              {sortedConcepts.length}
            </span>
          </div>

          {conceptsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-md" />
              ))}
            </div>
          ) : sortedConcepts.length === 0 ? (
            <div className="p-8 rounded-md border border-dashed border-[var(--line-default)] text-center text-[13px] text-[var(--fg-tertiary)]">
              No concepts extracted yet.
            </div>
          ) : (
            <div className="rounded-md border border-[var(--line-subtle)] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTh
                      label="Concept"
                      active={sortKey === "name"}
                      dir={sortDir}
                      onClick={() => handleSort("name")}
                    />
                    <SortableTh
                      label="Importance"
                      active={sortKey === "importance"}
                      dir={sortDir}
                      onClick={() => handleSort("importance")}
                      className="w-32"
                    />
                    <SortableTh
                      label="Mastery"
                      active={sortKey === "mastery"}
                      dir={sortDir}
                      onClick={() => handleSort("mastery")}
                      className="w-40"
                    />
                    <TableHead className="w-32 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedConcepts.map((c) => {
                    const mastery = c.mastery_score;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-[var(--fg-primary)]">
                                  {c.concept_name}
                                </span>
                                {(c.is_core || c.importance_score >= 4) && <CoreBadge />}
                              </div>
                              {c.concept_description && (
                                <p className="text-[12px] text-[var(--fg-tertiary)] mt-0.5 line-clamp-2">
                                  {c.concept_description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ImportanceDots
                            value={Math.min(5, Math.max(1, Math.round(c.importance_score)))}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1 w-20 rounded-full bg-[var(--bg-elev)] overflow-hidden">
                              <div
                                className="h-full bg-[var(--accent)] rounded-full"
                                style={{ width: `${mastery}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] tabular-nums text-[var(--fg-secondary)] w-9 text-right">
                              {Math.round(mastery)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={creating || document?.status !== "ready"}
                            onClick={() => handleStartQuiz([c.id])}
                          >
                            Train
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      </PageContainer>
    </AppShell>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors",
          active ? "text-[var(--fg-primary)]" : "hover:text-[var(--fg-secondary)]",
        )}
      >
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3",
            active ? "text-[var(--fg-secondary)]" : "text-[var(--fg-disabled)]",
            active && dir === "asc" && "rotate-180",
          )}
        />
      </button>
    </TableHead>
  );
}
