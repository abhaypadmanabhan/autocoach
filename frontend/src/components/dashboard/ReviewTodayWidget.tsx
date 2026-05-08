"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Zap, CheckCircle2, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { slideUpItem } from "@/lib/motions";
import { useCreateSession } from "@/hooks/useQuiz";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

interface DueConcept {
    id: string;
    name: string;
    document_id: string;
    mastery_score: number;
    mastery_percent: number;
}

interface ReviewResponse {
    count: number;
    due_concepts: DueConcept[];
    rules: {
        mastery_below: number;
        stale_days: number;
    };
}

export function ReviewTodayWidget() {
    const router = useRouter();
    const { showToast } = useToast();
    const { createSession, creating } = useCreateSession();

    const { data, error, isLoading } = useSWR<ReviewResponse>(
        "/review/today?limit=20",
        () => apiFetch<ReviewResponse>("/review/today?limit=20"),
        {
            revalidateOnFocus: true,
        }
    );





    const [limitReached, setLimitReached] = useState(false);

    const handleReviewNow = async () => {
        if (!data || data.count === 0) return;

        try {
            // Take top 5 due concepts
            const targetConcepts = data.due_concepts.slice(0, 5);
            // We need a document ID to start a session. 
            // The session creation API requires a single document_id.
            // But review concepts can come from multiple documents.
            // 
            // Constraint check: Does `createSession` support multi-doc?
            // Looking at `useQuiz.ts` and backend `create_session`:
            // Backend `create_session` takes `document_id`. 
            // It seems we can only quiz on one document at a time currently?
            // "Quiz session creation supports focus_concept_ids + num_questions"
            // But `document_id` is a required arg in `create_session`.
            //
            // Workaround: We pick the document of the *first* due concept and filter concepts to that doc only?
            // Or grouping?
            //
            // Let's look at the requirement: "Goal: Add a “Review Today” feature... lets users launch a short review quiz".
            // If the backend `create_session` enforces a single document_id, we must group.
            // 
            // Strategy:
            // 1. Group due concepts by document.
            // 2. Pick the document with the most due concepts (or just the first one).
            // 3. Start session for that document with those concepts.

            // For V1, let's just take the first concept's document and any other due concepts from that same doc.
            const primaryDocId = targetConcepts[0].document_id;
            const conceptsForDoc = targetConcepts.filter(c => c.document_id === primaryDocId);
            const conceptIds = conceptsForDoc.map(c => c.id).slice(0, 5);

            const session = await createSession({
                document_id: primaryDocId,
                num_questions: 5,
                difficulty: "medium",
                question_types: ["text_mcq", "text_tf", "text_free"],
                focus_concept_ids: conceptIds,
            });

            router.push(`/session?session_id=${session.session_id}`);
        } catch (err: any) {
            // Check for 429 limit reached
            if (err?.status === 429 || err?.response?.status === 429 || err?.message?.includes("limit")) {
                setLimitReached(true);
                showToast("Daily limit reached. Come back tomorrow.", "error");
            } else {
                showToast(getErrorMessage(err), "error");
            }
        }
    };

    if (isLoading) {
        return <ReviewTodaySkeleton />;
    }

    if (limitReached) {
        return (
            <motion.div variants={slideUpItem} className="w-full">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-md bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                        <Clock className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)] font-heading">
                        Smart Review
                    </h2>
                </div>
                <Card className="bg-[var(--surface-card)] border-[var(--surface-border)] relative overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-4 max-w-xl">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[var(--semantic-warning)] mb-1">
                                        <Clock className="w-5 h-5" />
                                        <span className="font-bold">Daily limit reached</span>
                                    </div>
                                    <p className="text-[var(--text-secondary)]">
                                        Come back tomorrow to continue reviewing.
                                    </p>
                                </div>
                            </div>
                            <div className="flex-shrink-0">
                                <Button
                                    disabled
                                    variant="outline"
                                    className="w-full md:w-auto opacity-60 cursor-not-allowed bg-muted/50 border-muted text-muted-foreground"
                                >
                                    <Clock className="w-4 h-4 mr-2" />
                                    Come back tomorrow
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    if (error) {
        return <ReviewTodayError onRetry={() => window.location.reload()} />;
    }

    // "You're all caught up" state is handled by NOT rendering? 
    // Requirement: "If none due: show “You’re all caught up” state" - wait, "If none: return count=0... If none due: show “You’re all caught up” state".
    // "No empty state" in the widget itself vs hiding?
    // "cta: Review Now... If none due: show 'You're all caught up' state" -> Implies it IS shown.

    // But typically dashboards hide empty "action" widgets. 
    // Let's show a nice "All caught up" card that is dismissible or just present.
    // Actually, "CTA: 'Review Now' (starts quiz) ... If none due: show..." implies persistent widget.

    const count = data?.count || 0;
    const isCaughtUp = count === 0;

    return (
        <motion.div variants={slideUpItem} className="w-full">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                    <Clock className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] font-heading">
                    Smart Review
                </h2>
            </div>

            <Card className="bg-[var(--surface-card)] border-[var(--surface-border)] relative overflow-hidden">
                {/* Decorative background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--brand-primary)]/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-4 max-w-xl">
                            {isCaughtUp ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[var(--semantic-success)] mb-1">
                                        <CheckCircle2 className="w-5 h-5" />
                                        <span className="font-bold">All caught up!</span>
                                    </div>
                                    <p className="text-[var(--text-secondary)]">
                                        You&apos;ve reviewed all your due concepts. Check back tomorrow for more.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-lg font-bold font-heading min-w-[2.5rem]">
                                            {count}
                                        </span>
                                        <span className="text-[var(--text-secondary)] font-medium">
                                            concepts due for review
                                        </span>
                                    </div>
                                    <p className="text-[var(--text-muted)] text-sm">
                                        We&apos;ve identified concepts that need reinforcement based on your mastery curves.
                                    </p>
                                    {/* Preview concepts */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {data?.due_concepts.slice(0, 3).map(c => (
                                            <span
                                                key={c.id}
                                                className="inline-flex items-center px-2 py-1 rounded-md bg-[var(--surface-darker)] border border-[var(--surface-border)] text-xs text-[var(--text-secondary)]"
                                            >
                                                {c.name}
                                            </span>
                                        ))}
                                        {count > 3 && (
                                            <span className="text-xs text-[var(--text-muted)] flex items-center px-1">
                                                +{count - 3} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-shrink-0">
                            {isCaughtUp ? (
                                <Button
                                    disabled
                                    variant="outline"
                                    className="w-full md:w-auto opacity-50 cursor-not-allowed"
                                >
                                    Review Now
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleReviewNow}
                                    disabled={creating}
                                    size="lg"
                                    className="w-full md:w-auto bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90 text-white shadow-lg shadow-[var(--brand-primary)]/20"
                                >
                                    {creating ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <Zap className="w-4 h-4 mr-2" />
                                    )}
                                    Review Now
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

function ReviewTodaySkeleton() {
    return (
        <motion.div variants={slideUpItem} className="w-full">
            <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-7 w-32" />
            </div>
            <Card className="bg-[var(--surface-card)] border-[var(--surface-border)]">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="space-y-4 w-full max-w-lg">
                            <Skeleton className="h-10 w-48" />
                            <Skeleton className="h-4 w-full" />
                            <div className="flex gap-2">
                                <Skeleton className="h-6 w-20" />
                                <Skeleton className="h-6 w-24" />
                                <Skeleton className="h-6 w-16" />
                            </div>
                        </div>
                        <Skeleton className="h-12 w-32 rounded-lg" />
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

interface ReviewTodayErrorProps {
    onRetry?: () => void;
}

function ReviewTodayError({ onRetry }: ReviewTodayErrorProps) {
    return (
        <motion.div variants={slideUpItem} className="w-full">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                    <Clock className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] font-heading">
                    Smart Review
                </h2>
            </div>
            <Card className="bg-[var(--surface-card)] border-[var(--surface-border)] relative overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[var(--semantic-warning)] mb-1">
                                <AlertCircle className="w-5 h-5" />
                                <span className="font-bold">Unable to load review data</span>
                            </div>
                            <p className="text-[var(--text-secondary)]">
                                We couldn&apos;t check for due concepts. Try refreshing the page.
                            </p>
                        </div>
                        {onRetry && (
                            <Button
                                onClick={onRetry}
                                variant="outline"
                                className="w-full md:w-auto"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Retry
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
