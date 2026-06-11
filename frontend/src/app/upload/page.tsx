"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CloudUpload,
  FileText,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";

import { useUploadDocument } from "@/hooks/useUploadDocument";
import { usePollDocumentStatus } from "@/hooks/useDocuments";
import { createBrowserClient } from "@/lib/supabase/client";
import { analytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

import { AppShell, PageContainer, Section } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { CornerCrosshair } from "@/components/primitives-acx/CornerCrosshair";

export default function UploadPage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const { upload, uploading, progress, stage, error: uploadError } = useUploadDocument();
  const { document } = usePollDocumentStatus(documentId);
  const conceptsTrackedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login");
    });
  }, [router]);

  // Track concepts extracted + redirect on ready
  useEffect(() => {
    if (
      document?.status === "ready" &&
      documentId &&
      document.concept_count != null &&
      !conceptsTrackedRef.current
    ) {
      conceptsTrackedRef.current = true;
      analytics.capture("concepts_extracted", {
        document_id: documentId,
        concept_count: document.concept_count,
      });
      const t = setTimeout(() => router.push(`/dashboard/${documentId}`), 1200);
      return () => clearTimeout(t);
    }
  }, [document?.status, document?.concept_count, documentId, router]);

  const handleUpload = useCallback(
    async (file: File) => {
      setPickedFile(file);
      try {
        const result = await upload(file);
        setDocumentId(result.id);
      } catch {
        // surfaced via uploadError state
      }
    },
    [upload],
  );

  const handleReset = useCallback(() => {
    setPickedFile(null);
    setDocumentId(null);
    conceptsTrackedRef.current = false;
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) await handleUpload(files[0]);
    },
    [handleUpload],
  );

  const onPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) await handleUpload(f);
    },
    [handleUpload],
  );

  const docStatus = document?.status;
  const isProcessing = uploading || (pickedFile && !docStatus) || docStatus === "pending" || docStatus === "processing";
  const isReady = docStatus === "ready";
  const isFailed = docStatus === "failed" || Boolean(uploadError);

  return (
    <AppShell title="Upload" eyebrow="Workspace" showBack backHref="/dashboard">
      <PageContainer size="md">
        <Section className="mt-2">
          <p className="kicker mb-2">03 / UPLOAD</p>
          <h1 className="font-display uppercase text-[36px] font-medium tracking-[-0.02em] text-[var(--fg-primary)]">
            What do you want to study?
          </h1>
          <p className="mt-2 text-[15px] text-[var(--fg-secondary)]">
            Drop a PDF or PowerPoint and we&apos;ll extract concepts and generate adaptive quizzes.
          </p>
        </Section>

        <Section>
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !pickedFile && inputRef.current?.click()}
            className={cn(
              "relative isolate min-h-[420px] p-8",
              "border bg-[var(--bg-base)]",
              "transition-[border-color,background-color] duration-[240ms]",
              !pickedFile && "cursor-pointer",
              isDragging
                ? "border-[var(--accent)] bg-[var(--accent-fade)]"
                : "border-dashed border-[var(--ink)]",
            )}
          >
            <CornerCrosshair corner="tl" />
            <CornerCrosshair corner="tr" />
            <CornerCrosshair corner="bl" />
            <CornerCrosshair corner="br" />

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.pptx"
              className="hidden"
              onChange={onPick}
            />

            <div className="flex flex-col items-center justify-center text-center min-h-[360px]">
              {!pickedFile && (
                <>
                  <div
                    className={cn(
                      "grid place-items-center h-16 w-16 mb-5",
                      "border bg-[var(--bg-elev)]",
                      isDragging
                        ? "border-[var(--accent)] text-[var(--accent)]"
                        : "border-[var(--line-default)] text-[var(--fg-secondary)]",
                    )}
                  >
                    <CloudUpload className="h-7 w-7" />
                  </div>
                  <h3 className="text-[18px] font-medium text-[var(--fg-primary)] mb-1.5">
                    {isDragging ? "Drop file to upload" : "Drag & drop your file"}
                  </h3>
                  <p className="text-[13px] text-[var(--fg-tertiary)]">
                    or{" "}
                    <span className="text-[var(--accent-text)]">click to browse</span>
                  </p>
                  <p className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
                    <FileText className="h-3 w-3" />
                    PDF · PPTX
                  </p>
                </>
              )}

              {pickedFile && isProcessing && !isReady && !isFailed && (
                <ProcessingOrb
                  filename={pickedFile.name}
                  bytes={pickedFile.size}
                  progress={progress}
                  stage={stage}
                  status={docStatus}
                />
              )}

              {pickedFile && isReady && (
                <>
                  <div className="grid place-items-center h-16 w-16 mb-5 border border-[var(--ink)] bg-[var(--bg-elev)]">
                    <CheckCircle2 className="h-7 w-7 text-[var(--accent-text)]" />
                  </div>
                  <h3 className="text-[18px] font-medium text-[var(--fg-primary)] mb-1.5">
                    {pickedFile.name}
                  </h3>
                  <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--accent-text)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
                    Ready
                  </p>
                  <p className="mt-2 text-[12px] text-[var(--fg-tertiary)]">
                    Redirecting to your document…
                  </p>
                </>
              )}

              {pickedFile && isFailed && (
                <>
                  <div className="grid place-items-center h-16 w-16 mb-5 border border-[var(--danger)] bg-[var(--bg-elev)]">
                    <AlertTriangle className="h-7 w-7 text-[var(--danger)]" />
                  </div>
                  <h3 className="text-[18px] font-medium text-[var(--fg-primary)] mb-1.5">
                    {pickedFile.name}
                  </h3>
                  <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--danger)] mb-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" aria-hidden />
                    {uploadError ?? document?.error_message ?? "Processing failed"}
                  </p>
                  {document?.error_message && (
                    <p className="font-mono text-[11px] text-[var(--fg-tertiary)] mt-2">
                      {document.error_message}
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleReset}
                    className="mt-5"
                  >
                    <X className="h-3.5 w-3.5" />
                    Try another file
                  </Button>
                </>
              )}
            </div>
          </div>
        </Section>

        <Section>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: "Clear text", desc: "Selectable PDFs work best" },
              { label: "Slides supported", desc: "PowerPoint .pptx files" },
              { label: "Fast extraction", desc: "Concepts ready in seconds" },
            ].map((tip) => (
              <div key={tip.label} className="space-y-1">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
                  {tip.label}
                </p>
                <p className="text-[13px] text-[var(--fg-secondary)]">{tip.desc}</p>
              </div>
            ))}
          </div>
        </Section>
      </PageContainer>
    </AppShell>
  );
}

function ProcessingOrb({
  filename,
  bytes,
  progress,
  stage,
  status,
}: {
  filename: string;
  bytes: number;
  progress: number;
  stage?: string;
  status?: string;
}) {
  const message =
    status === "processing"
      ? "Analyzing your document"
      : status === "pending"
        ? "Queued for processing"
        : stage === "uploading"
          ? "Uploading to storage"
          : stage === "registering"
            ? "Registering document"
            : "Preparing";

  const pct = status === "processing" ? Math.max(60, progress) : progress;

  return (
    <>
      <div className="relative grid place-items-center h-24 w-24 mb-6">
        <span className="absolute inset-0 rounded-full border border-[var(--line-default)] ring-spin" />
        <span
          className="absolute inset-2 rounded-full border border-[var(--line-default)] ring-spin"
          style={{ animationDuration: "10s", animationDirection: "reverse" }}
        />
        <span
          className="absolute inset-4 rounded-full border border-[var(--accent-line)] ring-spin"
          style={{ animationDuration: "16s" }}
        />
        <Loader2 className="h-5 w-5 text-[var(--fg-secondary)] animate-spin" />
      </div>
      <h3 className="text-[16px] font-medium text-[var(--fg-primary)] mb-1.5 max-w-[440px] truncate">
        {filename}
      </h3>
      <p className="font-mono text-[11px] tabular-nums text-[var(--fg-tertiary)] mb-4">
        {(bytes / 1024 / 1024).toFixed(2)} MB
      </p>
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--fg-secondary)] mb-3">{message}…</p>
      <div className="w-60 h-[8px] border border-[var(--ink)] bg-transparent overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-[240ms]"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[11px] tabular-nums text-[var(--fg-tertiary)]">
        {Math.round(pct)}%
      </p>
    </>
  );
}
