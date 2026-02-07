"use client";

import { useDocument } from "@/hooks/useDocuments";
import { useDocumentConcepts } from "@/hooks/useConcepts";
import { Loader2, PlayCircle, Star, GraduationCap, CheckCircle2, ChevronRight, HelpCircle } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DocumentDashboardProps {
    documentId: string;
}

export function DocumentDashboard({ documentId }: DocumentDashboardProps) {
    const { document, loading: documentLoading, error: documentError } = useDocument(documentId);
    const { concepts, loading: conceptsLoading, error: conceptsError } = useDocumentConcepts(documentId);

    if (documentLoading || conceptsLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 className="animate-spin text-brand-primary" size={32} />
            </div>
        );
    }

    if (documentError || conceptsError || !document) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
                <p className="text-semantic-error">Failed to load document dashboard.</p>
                <Link href="/dashboard" className="text-brand-primary hover:underline">
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    const coreConcepts = concepts.filter(c => c.is_core);
    const masteredConcepts = concepts.filter(c => (c.mastery_score || 0) >= 80);
    const totalMastery = document.progress || 0; // Use progress from document

    // Sort concepts: core first, then by importance
    const sortedConcepts = [...concepts].sort((a, b) => {
        if (a.is_core && !b.is_core) return -1;
        if (!a.is_core && b.is_core) return 1;
        return b.importance_score - a.importance_score;
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
                    <h1 className="text-3xl md:text-4xl font-serif text-text-primary font-medium">
                        {document.ai_title || document.filename}
                    </h1>
                    <div className="flex items-center gap-4 text-text-secondary text-sm">
                        <span>{concepts.length} Concepts Found</span>
                        <span>•</span>
                        <span>Created {new Date(document.created_at).toLocaleDateString()}</span>
                    </div>
                </div>

                <Link href={`/config?document_id=${document.id}&mode=recommend`}>
                    <Button size="lg" className="rounded-full bg-brand-primary hover:bg-brand-primary/90 text-surface-dark font-medium shadow-lg shadow-brand-primary/20 px-8">
                        <PlayCircle className="mr-2 h-5 w-5" />
                        Continue Learning
                    </Button>
                </Link>
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
            <div className="space-y-4">
                <h2 className="text-xl font-medium text-text-primary flex items-center gap-2">
                    Learning Concepts
                    <span className="text-sm font-normal text-text-muted bg-surface-card px-2 py-0.5 rounded-full">
                        {concepts.length}
                    </span>
                </h2>

                <div className="bg-surface-card border border-surface-border/50 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-surface-border/50 bg-surface-darker/30 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        <div className="col-span-6 md:col-span-5">Concept Name</div>
                        <div className="col-span-3 md:col-span-2 text-center">Importance</div>
                        <div className="col-span-3 md:col-span-3">Mastery</div>
                        <div className="col-span-12 md:col-span-2 text-right hidden md:block">Action</div>
                    </div>

                    <div className="divide-y divide-surface-border/30">
                        {sortedConcepts.map((concept) => (
                            <motion.div
                                key={concept.id}
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-surface-darker/20 transition-colors group"
                            >
                                <div className="col-span-6 md:col-span-5 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-text-primary">{concept.concept_name}</span>
                                        {concept.is_core && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 border-none">
                                                            CORE
                                                        </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Core concept essential for understanding</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                    {concept.concept_description && (
                                        <p className="text-xs text-text-muted line-clamp-1">{concept.concept_description}</p>
                                    )}
                                </div>

                                <div className="col-span-3 md:col-span-2 flex justify-center">
                                    <div className="flex gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                size={12}
                                                className={cn(
                                                    i < Math.round((concept.importance_score || 0) / 2)
                                                        ? "text-semantic-warning fill-semantic-warning"
                                                        : "text-surface-border"
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="col-span-3 md:col-span-3">
                                    <div className="flex items-center gap-3">
                                        <Progress value={concept.mastery_score || 0} className="h-1.5 bg-surface-border" />
                                        <span className="text-xs font-medium text-text-secondary w-8 text-right">
                                            {concept.mastery_score || 0}%
                                        </span>
                                    </div>
                                </div>

                                <div className="col-span-12 md:col-span-2 flex justify-end">
                                    <Link href={`/config?document_id=${document.id}&focus=${concept.id}`}>
                                        <Button variant="ghost" size="sm" className="h-8 text-xs hover:text-brand-primary hover:bg-brand-primary/10">
                                            Quiz Concept <ChevronRight size={14} className="ml-1 opacity-50" />
                                        </Button>
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
