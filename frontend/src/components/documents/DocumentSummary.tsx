"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen, Lightbulb, ListChecks, Sparkles, AlertCircle, RefreshCw, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDocumentSummary } from "@/hooks/useDocumentSummary";
import { Skeleton } from "@/components/ui/Skeleton";
import { analytics } from "@/lib/analytics";

interface DocumentSummaryProps {
    documentId: string;
}

export function DocumentSummary({ documentId }: DocumentSummaryProps) {
    const { summary, isLoading, error, mutate } = useDocumentSummary(documentId);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await mutate();
        setIsRefreshing(false);
    };

    if (isLoading) {
        return (
            <div className="bg-surface-card border border-surface-border/50 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        );
    }

    if (error) {
        // Check for specific error types
        const is404 = error.includes("404") || error.includes("not found");
        const is409 = error.includes("409") || error.includes("Concepts not ready");

        if (is404) {
            return (
                <div className="bg-surface-card border border-surface-border/50 rounded-xl p-6 flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-surface-darker flex items-center justify-center">
                        <FileX className="text-text-muted" size={24} />
                    </div>
                    <div>
                        <p className="text-text-primary font-medium">Document not found</p>
                        <p className="text-text-secondary text-sm mt-1">
                            This document may have been deleted or you don&apos;t have access.
                        </p>
                    </div>
                </div>
            );
        }

        if (is409) {
            return (
                <div className="bg-surface-card border border-surface-border/50 rounded-xl p-6 flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                        <Sparkles className="text-brand-primary opacity-70" size={24} />
                    </div>
                    <div>
                        <p className="text-text-primary font-medium">Summary coming soon</p>
                        <p className="text-text-secondary text-sm mt-1">
                            Summary will appear after concepts are ready.
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-surface-card border border-semantic-error/20 rounded-xl p-6 flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-semantic-error/10 flex items-center justify-center">
                    <AlertCircle className="text-semantic-error" size={24} />
                </div>
                <div>
                    <p className="text-text-primary font-medium">Failed to load summary</p>
                    <p className="text-text-secondary text-sm mt-1">
                        Something went wrong. Try refreshing the page.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="mt-2"
                >
                    <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                    Try Again
                </Button>
            </div>
        );
    }

    if (!summary) return null;

    // Check for empty/malformed summary data
    const hasOneLiner = summary.one_liner?.trim().length > 0;
    const hasLearningItems = summary.what_youll_learn?.length > 0;
    const hasKeyConcepts = summary.key_concepts?.length > 0;
    const hasStudyPlan = summary.study_plan?.length > 0;

    if (!hasOneLiner && !hasLearningItems && !hasKeyConcepts && !hasStudyPlan) {
        return (
            <div className="bg-surface-card border border-surface-border/50 rounded-xl p-6 flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-surface-darker flex items-center justify-center">
                    <Sparkles className="text-text-muted" size={24} />
                </div>
                <div>
                    <p className="text-text-primary font-medium">Summary not available</p>
                    <p className="text-text-secondary text-sm mt-1">
                        The summary appears to be empty. Try refreshing to regenerate.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="mt-2"
                >
                    <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                    Refresh
                </Button>
            </div>
        );
    }

    return (
        <div className="bg-surface-card border border-surface-border/50 rounded-xl overflow-hidden transition-all duration-300">
            {/* Header / Collapsed View */}
            <button
                className="w-full p-6 text-left hover:bg-surface-hover/5 transition-colors"
                onClick={() => {
                    if (!isExpanded) {
                        analytics.capture("summary_viewed", { document_id: documentId });
                    }
                    setIsExpanded(!isExpanded);
                }}
                aria-expanded={isExpanded}
                aria-controls="summary-content"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Sparkles className="w-5 h-5 text-brand-primary shrink-0" />
                            <h3 className="font-serif text-lg font-medium text-text-primary">
                                AI Summary
                            </h3>
                            <Badge variant="secondary" className="text-xs bg-brand-primary/10 text-brand-primary border-brand-primary/20">
                                Beta
                            </Badge>
                        </div>

                        {hasOneLiner ? (
                            <p className="text-text-secondary leading-relaxed">
                                {summary.one_liner}
                            </p>
                        ) : (
                            <p className="text-text-muted text-sm italic">
                                Click to view document insights
                            </p>
                        )}
                    </div>

                    <div className="shrink-0 text-text-muted">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div
                    id="summary-content"
                    className="px-6 pb-6 pt-0 space-y-6 animate-in slide-in-from-top-2 duration-200"
                >
                    <div className="h-px bg-surface-border/50 w-full" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        {/* What you'll learn */}
                        {hasLearningItems && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-text-primary font-medium">
                                    <BookOpen className="w-4 h-4 text-semantic-info shrink-0" />
                                    <h4>What You&apos;ll Learn</h4>
                                </div>
                                <ul className="space-y-3">
                                    {summary.what_youll_learn.map((item: string, i: number) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-text-secondary leading-relaxed">
                                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-semantic-info shrink-0" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Key Concepts */}
                        {hasKeyConcepts && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-text-primary font-medium">
                                    <Lightbulb className="w-4 h-4 text-semantic-warning shrink-0" />
                                    <h4>Key Concepts</h4>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {summary.key_concepts.map((concept: string, i: number) => (
                                        <Badge
                                            key={i}
                                            variant="outline"
                                            className="bg-semantic-warning/5 border-semantic-warning/20 text-text-secondary font-normal py-1 px-2.5"
                                        >
                                            {concept}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Study Plan */}
                    {hasStudyPlan && (
                        <div className="bg-surface-bg/50 rounded-xl p-5 space-y-4">
                            <div className="flex items-center gap-2 text-text-primary font-medium">
                                <ListChecks className="w-4 h-4 text-semantic-success shrink-0" />
                                <h4>Suggested Study Plan</h4>
                            </div>
                            <div className="space-y-3">
                                {summary.study_plan.map((step: string, i: number) => (
                                    <div key={i} className="flex gap-3 text-sm text-text-secondary leading-relaxed">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-semantic-success/10 text-semantic-success text-xs font-bold shrink-0">
                                            {i + 1}
                                        </span>
                                        <span className="pt-0.5">{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer with refresh button */}
                    <div className="flex items-center justify-between pt-4 border-t border-surface-border/30">
                        <p className="text-xs text-text-muted">
                            Generated by AI • May contain inaccuracies
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="text-text-muted hover:text-text-primary"
                        >
                            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
