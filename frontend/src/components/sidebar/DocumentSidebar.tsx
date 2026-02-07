"use client";

import { useDocuments } from "@/hooks/useDocuments";
import { cn } from "@/lib/utils";
import { FileText, Loader2, Plus, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export function DocumentSidebar() {
    const { documents, isLoading, error } = useDocuments();
    const searchParams = useSearchParams();
    const activeDocId = searchParams.get("docId");

    const sortedDocuments = [...documents].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const StatusIcon = ({ status }: { status: string }) => {
        switch (status) {
            case "ready":
                return <CheckCircle2 size={14} className="text-semantic-success" />;
            case "processing":
                return <Loader2 size={14} className="text-brand-primary animate-spin" />;
            case "failed":
                return <XCircle size={14} className="text-semantic-error" />;
            default:
                return <Clock size={14} className="text-text-muted" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface-darker/50 text-text-primary p-4 gap-4">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Library
                </h2>
                <Link
                    href="/upload"
                    className="p-1.5 rounded-md hover:bg-surface-border/50 text-text-secondary hover:text-text-primary transition-colors"
                    title="Upload new document"
                >
                    <Plus size={16} />
                </Link>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-brand-primary" />
                </div>
            )}

            {error && (
                <div className="bg-semantic-error/10 text-semantic-error text-sm p-3 rounded-md flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>Failed to load documents</span>
                </div>
            )}

            {!isLoading && !error && (
                <div className="flex flex-col gap-2 overflow-y-auto flex-1 -mx-2 px-2 scrollbar-thin scrollbar-thumb-surface-border scrollbar-track-transparent">
                    {sortedDocuments.length === 0 ? (
                        <div className="text-center py-8 px-4">
                            <p className="text-text-muted text-sm mb-4">No documents yet.</p>
                            <Link
                                href="/upload"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-medium hover:bg-brand-primary/20 transition-colors"
                            >
                                Start Learning
                            </Link>
                        </div>
                    ) : (
                        sortedDocuments.map((doc) => {
                            const isActive = activeDocId === doc.id;

                            return (
                                <Link
                                    key={doc.id}
                                    href={`/dashboard?docId=${doc.id}`}
                                    className={cn(
                                        "group flex flex-col gap-2 p-3 rounded-lg transition-all border border-transparent",
                                        isActive
                                            ? "bg-brand-primary/10 border-brand-primary/20 shadow-sm"
                                            : "hover:bg-surface-card/50 hover:border-surface-border/50"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "mt-0.5 p-1.5 rounded-md",
                                            isActive ? "bg-brand-primary/20 text-brand-primary" : "bg-surface-card text-text-muted group-hover:text-text-secondary"
                                        )}>
                                            <FileText size={16} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <h3 className={cn(
                                                    "text-sm font-medium truncate",
                                                    isActive ? "text-brand-primary" : "text-text-primary"
                                                )}>
                                                    {doc.ai_title || doc.filename}
                                                </h3>
                                                <StatusIcon status={doc.status} />
                                            </div>

                                            {doc.status === "ready" && (
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                                                        <span>Mastery</span>
                                                        <span>{Math.round(doc.progress || 0)}%</span>
                                                    </div>
                                                    <Progress value={doc.progress || 0} className="h-1 bg-surface-border/30" />
                                                </div>
                                            )}

                                            {doc.status === "processing" && (
                                                <span className="text-xs text-brand-primary flex items-center gap-1.5">
                                                    <span className="w-1 h-1 rounded-full bg-brand-primary animate-pulse" />
                                                    Processing...
                                                </span>
                                            )}

                                            {doc.status === "failed" && (
                                                <span className="text-xs text-semantic-error">
                                                    Processing failed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            )}

            {/* Footer / User Tip */}
            <div className="pt-4 border-t border-surface-border/30">
                <div className="p-3 rounded-lg bg-surface-card/30 border border-surface-border/30">
                    <p className="text-xs text-text-muted">
                        <strong className="text-text-secondary">Tip:</strong> Select a document to view detailed concepts and start targeted quizzes.
                    </p>
                </div>
            </div>
        </div>
    );
}
