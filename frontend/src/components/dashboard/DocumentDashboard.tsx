"use client";

import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";

import { useDocument, useDeleteDocument } from "@/hooks/useDocuments";
import { useDocumentConcepts } from "@/hooks/useConcepts";
import { useDocumentProgress } from "@/hooks/useDocumentProgress";
import { useToast } from "@/hooks/useToast";
import { PlayCircle, Star, GraduationCap, CheckCircle2, Trash2, AlertTriangle, Loader2, Trophy, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConceptList } from "@/components/dashboard/ConceptList";
import { DashboardSkeleton } from "@/components/features/dashboard/DashboardSkeleton";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { MascotStage } from "@/components/brand/MascotStage";
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface DocumentDashboardProps {
    documentId: string;
}

export function DocumentDashboard({ documentId }: DocumentDashboardProps) {
    const router = useRouter();
    const { document, loading: documentLoading, error: documentError } = useDocument(documentId);
    const { concepts, isLoading: conceptsLoading, error: conceptsError, refetch } = useDocumentConcepts(documentId);
    const { progress, isLoading: progressLoading } = useDocumentProgress(documentId);
    const { deleteDocument, deleting } = useDeleteDocument();
    const { showToast } = useToast();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const conceptsTrackedRef = useRef(false);

    useEffect(() => {
        conceptsTrackedRef.current = false;
    }, [documentId]);

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

    // Auto-refresh concepts AND sidebar list when document becomes ready
    useEffect(() => {
        if (document?.status === "ready") {
            // Refresh sidebar list to show specific AI title
            mutate("/documents/");

            if (concepts.length === 0) {
                console.log("Document ready but no concepts, triggering refetch...");
                refetch();
            } else if (!conceptsTrackedRef.current) {
                const CONCEPTS_TRACKED_KEY = `concepts_extracted_${documentId}`;
                if (!sessionStorage.getItem(CONCEPTS_TRACKED_KEY)) {
                    sessionStorage.setItem(CONCEPTS_TRACKED_KEY, "1");
                    analytics.capture("concepts_extracted", {
                        document_id: documentId,
                        concept_count: concepts.length,
                    });
                }
                conceptsTrackedRef.current = true;
            }
        }
    }, [document?.status, concepts.length, refetch, documentId]);

    if (documentLoading || conceptsLoading || progressLoading) {
        return <DashboardSkeleton />;
    }

    if (documentError || conceptsError || !document) {
        return (
            <div className="p-6 md:p-8 max-w-5xl mx-auto">
                <ErrorCard
                    error={documentError || conceptsError || "Failed to load document dashboard"}
                    onRetry={() => window.location.reload()}
                />
                <div className="mt-6 text-center">
                    <Link href="/dashboard" className="text-brand-primary hover:underline">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const coreConcepts = concepts.filter(c => c.is_core);
    const masteredConcepts = concepts.filter(c => (c.mastery_score || 0) >= 80);

    // Use progress data if available, fallback to manual calculation
    const totalMastery = progress?.mastery_percent ?? document.progress ?? 0;
    const milestone = progress?.milestone;

    // Milestone config
    const getMilestoneConfig = (m: string) => {
        switch (m) {
            case "25": return { label: "Apprentice", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" };
            case "50": return { label: "Scholar", color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" };
            case "75": return { label: "Expert", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" };
            case "100": return { label: "Master", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
            default: return null;
        }
    };

    const milestoneConfig = milestone && milestone !== "none" ? getMilestoneConfig(milestone) : null;

    // CTA for weak concepts
    const hasWeakConcepts = (progress?.weak_concepts_count ?? 0) > 0;

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-text-secondary border-surface-border">
                            Document Dashboard
                        </Badge>
                        {document.status === "processing" && (
                            <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary">
                                Processing
                            </Badge>
                        )}
                        {milestoneConfig && (
                            <Badge variant="secondary" className={cn(milestoneConfig.bg, milestoneConfig.color, "border", milestoneConfig.border)}>
                                <Trophy className="w-3 h-3 mr-1" />
                                {milestoneConfig.label}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl md:text-4xl font-serif text-text-primary font-medium">
                            {document.ai_title || document.filename}
                        </h1>
                        <MascotStage mode="dashboard" />
                    </div>
                    <div className="flex items-center gap-4 text-text-secondary text-sm">
                        <span>{concepts.length} Concepts Found</span>
                        <span>•</span>
                        <span>Created {new Date(document.created_at).toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setDeleteModalOpen(true)}
                        className="rounded-full border-semantic-error/30 text-semantic-error hover:bg-semantic-error/10 hover:text-semantic-error"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </Button>

                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => window.location.reload()}
                        className="rounded-full"
                    >
                        Refresh Data
                    </Button>

                    {hasWeakConcepts ? (
                        <Link href={`/dashboard?docId=${document.id}`}>
                            <Button size="lg" className="rounded-full bg-brand-primary hover:bg-brand-primary/90 text-surface-dark font-medium shadow-lg shadow-brand-primary/20 px-8">
                                <PlayCircle className="mr-2 h-5 w-5" />
                                Train Weak Concepts
                            </Button>
                        </Link>
                    ) : (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link href={`/dashboard?docId=${document.id}`}>
                                        <Button size="lg" className="rounded-full bg-brand-primary hover:bg-brand-primary/90 text-surface-dark font-medium shadow-lg shadow-brand-primary/20 px-8">
                                            <PlayCircle className="mr-2 h-5 w-5" />
                                            Continue Learning
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                    <p>No weak concepts yet. Start learning to identify focus areas.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-card border border-surface-border/50 rounded-xl p-6 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-text-secondary text-sm font-medium uppercase tracking-wider">Overall Mastery</span>
                        <CheckCircle2 className="text-brand-primary opacity-50" size={20} />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-serif text-text-primary">{Math.round(totalMastery)}%</span>
                        <span className="text-sm text-text-muted mb-1">core mastery</span>
                    </div>
                    <Progress value={totalMastery} className="h-2 mt-2" />
                    {totalMastery === 0 && (
                        <p className="text-xs text-text-secondary mt-2">
                            Start your first sprint to begin tracking mastery
                        </p>
                    )}
                </div>

                <div className="bg-surface-card border border-surface-border/50 rounded-xl p-6 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-text-secondary text-sm font-medium uppercase tracking-wider">Concepts Mastered</span>
                        <GraduationCap className="text-semantic-success opacity-50" size={20} />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-serif text-text-primary">{progress?.mastered_concepts_count ?? masteredConcepts.length}</span>
                        <span className="text-sm text-text-muted mb-1">/ {progress?.concepts_total ?? concepts.length} concepts</span>
                    </div>
                    <div className="flex gap-1 mt-3">
                        {/* Mini concept dots visualization */}
                        {concepts.slice(0, 10).map((c, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "h-1.5 flex-1 rounded-full",
                                    (c.mastery_score || 0) >= 80 ? "bg-semantic-success" : "bg-surface-border"
                                )}
                            />
                        ))}
                        {concepts.length > 10 && <div className="h-1.5 w-1.5 rounded-full bg-surface-border" />}
                    </div>
                </div>

                <div className="bg-surface-card border border-surface-border/50 rounded-xl p-6 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-text-secondary text-sm font-medium uppercase tracking-wider">Focus Areas</span>
                        <Star className="text-semantic-warning opacity-50" size={20} />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-serif text-text-primary">{progress?.weak_concepts_count ?? 0}</span>
                        <span className="text-sm text-text-muted mb-1">weak concepts</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                        {hasWeakConcepts
                            ? "Prioritize practicing these concepts to improve mastery."
                            : `Focus on core concepts like ${coreConcepts.slice(0, 2).map(c => c.concept_name).join(", ")}...`}
                    </p>
                </div>
            </div>

            {/* Concept List */}
            <ConceptList documentId={document.id} concepts={concepts} />

            {/* Delete Confirmation Modal */}
            <AlertDialog open={deleteModalOpen} onOpenChange={(open) => { if (!open) setDeleteModalOpen(false); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <div className="w-12 h-12 rounded-full bg-semantic-error/10 flex items-center justify-center mx-auto mb-2">
                            <AlertTriangle size={24} className="text-semantic-error" />
                        </div>
                        <AlertDialogTitle className="text-center">Delete Document</AlertDialogTitle>
                        <AlertDialogDescription className="text-center">
                            Are you sure you want to delete &quot;{document.ai_title || document.filename}&quot;? This will also delete all associated quiz sessions and cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleting}
                            onClick={(e) => { e.preventDefault(); handleDeleteConfirm(); }}
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
        </div>
    );
}
