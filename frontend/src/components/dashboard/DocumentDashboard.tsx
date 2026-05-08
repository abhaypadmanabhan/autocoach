"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { mutate } from "swr";

import { useDocument, useDeleteDocument } from "@/hooks/useDocuments";
import { useDocumentConcepts } from "@/hooks/useConcepts";
import { useDocumentProgress } from "@/hooks/useDocumentProgress";
import { useCreateSession } from "@/hooks/useQuiz";
import { useToast } from "@/hooks/useToast";
import {
    PlayCircle,
    Trash2,
    AlertTriangle,
    Loader2,
    Trophy,
    RefreshCw,
    FileQuestion,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/types";
import { ConceptList } from "@/components/dashboard/ConceptList";
import { DashboardSkeleton } from "@/components/features/dashboard/DashboardSkeleton";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { MascotStage } from "@/components/brand/MascotStage";
import { PageContainer } from "@/components/layout/AppShell";
import { staggerContainer, slideUpItem } from "@/lib/motions";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from "@/components/primitives/Modal";

interface DocumentDashboardProps {
    documentId: string;
}

const MASTERY_THRESHOLD = 80;

export function DocumentDashboard({ documentId }: DocumentDashboardProps) {
    const router = useRouter();
    const { document, loading: documentLoading, error: documentError } = useDocument(documentId);
    const { concepts, isLoading: conceptsLoading, error: conceptsError, refetch } = useDocumentConcepts(documentId);
    const { progress, isLoading: progressLoading } = useDocumentProgress(documentId);
    const { deleteDocument, deleting } = useDeleteDocument();
    const { createSession, creating } = useCreateSession();
    const { showToast } = useToast();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const conceptsTrackedRef = useRef(false);

    useEffect(() => {
        conceptsTrackedRef.current = false;
    }, [documentId]);

    useEffect(() => {
        if (document?.status === "ready") {
            mutate("/documents/");

            if (concepts.length === 0) {
                refetch();
            } else if (!conceptsTrackedRef.current) {
                const key = `concepts_extracted_${documentId}`;
                if (!sessionStorage.getItem(key)) {
                    sessionStorage.setItem(key, "1");
                    analytics.capture("concepts_extracted", {
                        document_id: documentId,
                        concept_count: concepts.length,
                    });
                }
                conceptsTrackedRef.current = true;
            }
        }
    }, [document?.status, concepts.length, refetch, documentId]);

    const handleDeleteConfirm = async () => {
        try {
            await deleteDocument(documentId);
            showToast("Document deleted successfully", "success");
            setDeleteModalOpen(false);
            router.push("/dashboard");
        } catch {
            showToast("Failed to delete document", "error");
        }
    };

    const handleStartQuiz = async () => {
        if (!document) return;
        try {
            const session = await createSession({
                document_id: document.id,
                num_questions: 10,
                difficulty: "medium",
                question_types: ["text_mcq", "text_tf", "text_free"],
            });
            router.push(`/session?session_id=${session.session_id}`);
        } catch (err: unknown) {
            const status = err instanceof ApiError ? err.status : undefined;
            const msg =
                status === 429
                    ? "Daily quiz limit reached."
                    : "Couldn't start quiz. Try again.";
            showToast(msg, "error");
        }
    };

    if (documentLoading || conceptsLoading || progressLoading) {
        return <DashboardSkeleton />;
    }

    if (documentError || conceptsError || !document) {
        return (
            <PageContainer size="xl">
                <div className="py-16">
                    <ErrorCard
                        error={documentError || conceptsError || "Failed to load document"}
                        onRetry={() => window.location.reload()}
                    />
                    <div className="mt-6 text-center">
                        <Link href="/dashboard" className="text-brand-primary hover:underline">
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </PageContainer>
        );
    }

    const masteredCount = concepts.filter(
        (c) => (c.mastery_score ?? 0) >= MASTERY_THRESHOLD,
    ).length;
    const totalMastery = progress?.mastery_percent ?? document.progress ?? 0;
    const milestone = progress?.milestone;
    const allMastered = concepts.length > 0 && masteredCount === concepts.length;

    const milestoneConfig = (() => {
        switch (milestone) {
            case "25": return { label: "Apprentice", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" };
            case "50": return { label: "Scholar", color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" };
            case "75": return { label: "Expert", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" };
            case "100": return { label: "Master", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
            default: return null;
        }
    })();

    return (
        <PageContainer size="xl">
            <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-14 md:space-y-20 py-8 md:py-12"
            >
                {/* Header */}
                <motion.header
                    variants={slideUpItem}
                    className="flex items-start justify-between gap-6"
                >
                    <div className="space-y-4 flex-1 min-w-0">
                        <span className="text-xs uppercase tracking-[0.2em] text-text-muted font-medium">
                            Document
                        </span>
                        <div className="flex items-center gap-4 flex-wrap">
                            <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif text-text-primary leading-[1.05] tracking-tight">
                                {document.ai_title || document.filename}
                            </h1>
                            <MascotStage mode="dashboard" />
                        </div>
                        {milestoneConfig && (
                            <Badge
                                variant="secondary"
                                className={cn(
                                    milestoneConfig.bg,
                                    milestoneConfig.color,
                                    "border",
                                    milestoneConfig.border,
                                )}
                            >
                                <Trophy className="w-3 h-3 mr-1" />
                                {milestoneConfig.label}
                            </Badge>
                        )}
                        {document.status === "ready" && concepts.length > 0 && (
                            <p className="text-text-secondary text-sm">
                                <span className="text-text-primary font-medium">
                                    {masteredCount}
                                </span>{" "}
                                of{" "}
                                <span className="text-text-primary font-medium">
                                    {concepts.length}
                                </span>{" "}
                                concepts mastered
                                <span className="text-text-muted mx-2">·</span>
                                <span className="text-text-primary font-medium">
                                    {Math.round(totalMastery)}%
                                </span>{" "}
                                overall
                            </p>
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteModalOpen(true)}
                        className="rounded-full text-text-muted hover:text-semantic-error hover:bg-semantic-error/10 shrink-0"
                        aria-label="Delete document"
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                </motion.header>

                {/* Primary CTA section — state-driven */}
                <motion.section variants={slideUpItem} className="py-4 md:py-8">
                    {document.status === "processing" ? (
                        <ProcessingCTA />
                    ) : document.status === "failed" ? (
                        <FailedCTA errorMessage={document.error_message} />
                    ) : concepts.length === 0 ? (
                        <NoConceptsCTA />
                    ) : (
                        <StartQuizCTA
                            onClick={handleStartQuiz}
                            creating={creating}
                            allMastered={allMastered}
                            conceptCount={concepts.length}
                        />
                    )}
                </motion.section>

                {/* Concept list — only when populated */}
                {concepts.length > 0 && (
                    <motion.section variants={slideUpItem}>
                        <ConceptList documentId={document.id} concepts={concepts} />
                    </motion.section>
                )}
            </motion.div>

            {/* Delete confirmation modal */}
            <AlertDialog
                open={deleteModalOpen}
                onOpenChange={(open) => {
                    if (!open) setDeleteModalOpen(false);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="w-12 h-12 rounded-full bg-semantic-error/10 flex items-center justify-center mx-auto mb-2">
                            <AlertTriangle size={24} className="text-semantic-error" />
                        </div>
                        <AlertDialogTitle className="text-center">
                            Delete Document
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-center">
                            Are you sure you want to delete &quot;
                            {document.ai_title || document.filename}&quot;? This will also
                            delete all associated quiz sessions and cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleting}
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteConfirm();
                            }}
                            className="bg-semantic-error text-white hover:bg-semantic-error/90"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PageContainer>
    );
}

function StartQuizCTA({
    onClick,
    creating,
    allMastered,
    conceptCount,
}: {
    onClick: () => void;
    creating: boolean;
    allMastered: boolean;
    conceptCount: number;
}) {
    const label = allMastered ? "Review Mastered Concepts" : "Start Quiz";
    const Icon = allMastered ? RefreshCw : PlayCircle;

    return (
        <div className="flex flex-col items-start gap-4">
            <motion.button
                onClick={onClick}
                disabled={creating}
                whileHover={creating ? {} : { scale: 1.01 }}
                whileTap={creating ? {} : { scale: 0.99 }}
                className={cn(
                    "inline-flex items-center justify-center gap-3",
                    "rounded-full px-12 md:px-16 py-6 md:py-7",
                    "text-lg md:text-xl font-semibold",
                    "text-white",
                    "transition-shadow",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    allMastered
                        ? "bg-gradient-to-r from-[var(--semantic-success)] to-[var(--brand-primary)] hover:shadow-2xl hover:shadow-[var(--semantic-success)]/30"
                        : "bg-gradient-to-r from-[var(--pop-coral)] to-[var(--pop-gold)] hover:shadow-2xl hover:shadow-[var(--pop-coral)]/30",
                )}
            >
                {creating ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                    <Icon className="h-6 w-6" />
                )}
                {creating ? "Starting quiz…" : label}
            </motion.button>
            <p className="text-sm text-text-muted pl-2">
                {allMastered
                    ? `Mastered all ${conceptCount} concepts. Refresh your memory.`
                    : "10 questions · adaptive difficulty"}
            </p>
        </div>
    );
}

function ProcessingCTA() {
    return (
        <div className="flex flex-col items-start gap-4">
            <button
                disabled
                className="inline-flex items-center justify-center gap-3 rounded-full px-12 md:px-16 py-6 md:py-7 text-lg md:text-xl font-semibold bg-surface-card border border-surface-border text-text-muted cursor-not-allowed"
            >
                <Loader2 className="h-6 w-6 animate-spin" />
                Preparing your quiz…
            </button>
            <p className="text-sm text-text-muted pl-2">
                Extracting concepts from your document. This usually takes a minute.
            </p>
        </div>
    );
}

function FailedCTA({ errorMessage }: { errorMessage?: string }) {
    return (
        <div className="rounded-2xl border border-semantic-error/30 bg-semantic-error/5 p-6 md:p-8 max-w-2xl">
            <div className="flex items-start gap-4">
                <AlertTriangle className="text-semantic-error mt-1 shrink-0" size={24} />
                <div className="space-y-3 flex-1">
                    <p className="text-text-primary font-medium text-lg">
                        We couldn&apos;t process this document.
                    </p>
                    {errorMessage && (
                        <p className="text-sm text-text-secondary">{errorMessage}</p>
                    )}
                    <Button asChild variant="outline" size="sm" className="mt-1">
                        <Link href="/upload">Try a new upload</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}

function NoConceptsCTA() {
    return (
        <div className="rounded-2xl border border-surface-border bg-surface-card/30 p-6 md:p-8 max-w-2xl">
            <div className="flex items-start gap-4">
                <FileQuestion
                    className="text-text-muted mt-1 shrink-0"
                    size={24}
                />
                <div className="space-y-3 flex-1">
                    <p className="text-text-primary font-medium text-lg">
                        No concepts could be extracted from this document.
                    </p>
                    <p className="text-sm text-text-secondary">
                        The document may be empty, scanned without OCR, or in an
                        unsupported format.
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-1">
                        <Link href="/upload">Try a new upload</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
