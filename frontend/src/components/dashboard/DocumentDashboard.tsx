"use client";

import { useEffect } from "react";

import { useDocument } from "@/hooks/useDocuments";
import { useDocumentConcepts } from "@/hooks/useConcepts";
import { PlayCircle, Star, GraduationCap, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConceptList } from "@/components/dashboard/ConceptList";
import { DashboardSkeleton } from "@/components/features/dashboard/DashboardSkeleton";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { SentinelMascot } from "@/components/brand/SentinelMascot";

interface DocumentDashboardProps {
    documentId: string;
}

export function DocumentDashboard({ documentId }: DocumentDashboardProps) {
    const { document, loading: documentLoading, error: documentError } = useDocument(documentId);
    const { concepts, loading: conceptsLoading, error: conceptsError, refetch } = useDocumentConcepts(documentId);

    // Auto-refresh concepts when document becomes ready
    useEffect(() => {
        if (document?.status === "ready" && concepts.length === 0) {
            console.log("Document ready but no concepts, triggering refetch...");
            refetch();
        }
    }, [document?.status, concepts.length, refetch]);

    if (documentLoading || conceptsLoading) {
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
    const totalMastery = document.progress || 0;

    // Debugging
    console.log("DocumentDashboard render:", {
        docId: documentId,
        conceptsCount: concepts.length,
        conceptsLoading,
        conceptsError,
        mappedConcepts: concepts
    });

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
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl md:text-4xl font-serif text-text-primary font-medium">
                            {document.ai_title || document.filename}
                        </h1>
                        <SentinelMascot variant="neutral" className="w-10 h-10" />
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
                        onClick={() => window.location.reload()}
                        className="rounded-full"
                    >
                        Refresh Data
                    </Button>

                    <Link href={`/config?document_id=${document.id}&mode=recommend`}>
                        <Button size="lg" className="rounded-full bg-brand-primary hover:bg-brand-primary/90 text-surface-dark font-medium shadow-lg shadow-brand-primary/20 px-8">
                            <PlayCircle className="mr-2 h-5 w-5" />
                            Continue Learning
                        </Button>
                    </Link>
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
                </div>

                <div className="bg-surface-card border border-surface-border/50 rounded-xl p-6 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-text-secondary text-sm font-medium uppercase tracking-wider">Concepts Mastered</span>
                        <GraduationCap className="text-semantic-success opacity-50" size={20} />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-serif text-text-primary">{masteredConcepts.length}</span>
                        <span className="text-sm text-text-muted mb-1">/ {concepts.length} concepts</span>
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
                        <span className="text-4xl font-serif text-text-primary">{coreConcepts.length}</span>
                        <span className="text-sm text-text-muted mb-1">core concepts detected</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                        Focus on core concepts like {coreConcepts.slice(0, 2).map(c => c.concept_name).join(", ")}...
                    </p>
                </div>
            </div>

            {/* Concept List */}
            <ConceptList documentId={document.id} concepts={concepts} />
        </div>
    );
}
