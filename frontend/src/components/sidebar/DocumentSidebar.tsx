"use client";

import { useDocuments } from "@/hooks/useDocuments";
import { cn } from "@/lib/utils";
import { groupDocumentsByDate } from "@/lib/date";
import { FileText, Loader2, Plus, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/brand/Logo";

export function DocumentSidebar() {
    const { documents, isLoading, error } = useDocuments();
    const searchParams = useSearchParams();
    const activeDocId = searchParams.get("docId");

    // Sort documents by date first
    const sortedDocuments = [...documents].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Group documents
    const groupedDocuments = groupDocumentsByDate(sortedDocuments);
    const groups = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days", "Older"] as const;

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
        <div className="flex flex-col h-full bg-[var(--surface-darker)] text-[var(--text-primary)]">
            {/* Logo Section - Pushes content down */}
            <div className="p-4 border-b border-[var(--surface-border)]/50">
                <Link href="/dashboard" className="flex items-center justify-center">
                    <Logo size="lg" animated />
                </Link>
            </div>

            {/* Action Area */}
            <div className="p-4 border-b border-[var(--surface-border)]/50">
                <Link href="/upload">
                    <motion.button
                        className="w-full flex items-center justify-center gap-2 bg-[var(--brand-primary)] text-[var(--surface-dark)] py-2.5 rounded-lg font-semibold hover:brightness-110 transition-all shadow-lg shadow-[var(--brand-primary)]/20"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Plus size={18} />
                        New Document
                    </motion.button>
                </Link>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-brand-primary" />
                </div>
            )}

            {error && (
                <div className="mx-4 bg-semantic-error/10 text-semantic-error text-sm p-3 rounded-md flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>Failed to load documents</span>
                </div>
            )}

            {!isLoading && !error && (
                <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin scrollbar-thumb-surface-border scrollbar-track-transparent">
                    {sortedDocuments.length === 0 ? (
                        <div className="text-center py-8 px-4">
                            <p className="text-text-muted text-sm mb-4">No documents yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 pt-2">
                            {groups.map((group) => {
                                const groupDocs = groupedDocuments[group];
                                if (!groupDocs || groupDocs.length === 0) return null;

                                return (
                                    <div key={group} className="space-y-1">
                                        <h3 className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                                            {group}
                                        </h3>
                                        <div className="space-y-0.5">
                                            {groupDocs.map((doc) => {
                                                const isActive = activeDocId === doc.id;

                                                return (
                                                    <Link
                                                        key={doc.id}
                                                        href={`/dashboard?docId=${doc.id}`}
                                                        className={cn(
                                                            "group flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm",
                                                            isActive
                                                                ? "bg-surface-card text-text-primary border border-brand-primary/20"
                                                                : "text-text-muted hover:bg-surface-card/50 hover:text-text-secondary"
                                                        )}
                                                        title={doc.ai_title || doc.filename}
                                                    >
                                                        <FileText size={14} className={cn(
                                                            "shrink-0",
                                                            isActive ? "text-brand-primary" : "text-text-muted group-hover:text-text-secondary"
                                                        )} />

                                                        <span className="truncate flex-1">
                                                            {doc.ai_title || doc.filename}
                                                        </span>

                                                        {doc.status !== "ready" && (
                                                            <div className="shrink-0">
                                                                <StatusIcon status={doc.status} />
                                                            </div>
                                                        )}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Footer spacer */}
            <div className="shrink-0 h-2" />
        </div>
    );
}
