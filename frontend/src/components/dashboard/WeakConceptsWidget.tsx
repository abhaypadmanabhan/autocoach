"use client";

import { motion } from "framer-motion";
import { Loader2, Target, Zap, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { slideUpItem } from "@/lib/motions";
import { useCreateSession } from "@/hooks/useQuiz";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

interface WeakConcept {
    id: string;
    concept_name: string;
    document_id: string;
    mastery_score: number;
    mastery_percent: number;
    times_tested: number;
}

export function WeakConceptsWidget() {
    const router = useRouter();
    const { showToast } = useToast();
    const { createSession, creating } = useCreateSession();

    const { data: concepts, error, isLoading } = useSWR<WeakConcept[]>(
        "/concepts/weakest?limit=3",
        () => apiFetch<WeakConcept[]>("/concepts/weakest?limit=3"),
        {
            revalidateOnFocus: false,
        }
    );

    const handleTrain = async (concept: WeakConcept) => {
        try {
            const session = await createSession({
                document_id: concept.document_id,
                num_questions: 5,
                difficulty: "medium",
                question_types: ["mcq", "true_false", "free_text"],
                focus_concept_ids: [concept.id],
            });

            router.push(`/session?session_id=${session.session_id}`);
        } catch (err) {
            showToast(getErrorMessage(err), "error");
        }
    };

    if (isLoading) {
        return <WeakConceptsSkeleton />;
    }

    // Error state - show friendly message instead of hiding
    if (error) {
        return <WeakConceptsError />;
    }

    // Empty state - don't show widget if no weak concepts
    if (!concepts || concepts.length === 0) {
        return null;
    }

    return (
        <motion.div variants={slideUpItem} className="w-full mb-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-[var(--semantic-warning)]/10 text-[var(--semantic-warning)]">
                        <Target className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)] font-heading">
                        Focus Areas
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {concepts.map((concept) => (
                    <Card
                        key={concept.id}
                        className="bg-[var(--surface-card)] border-[var(--surface-border)] hover:border-[var(--brand-primary)]/30 transition-all group relative overflow-hidden"
                    >
                        {/* Background gradient for "weak" feel */}
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[var(--semantic-warning)]/5 to-transparent -mr-4 -mt-4 rounded-full blur-xl" />

                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-medium text-[var(--text-primary)] truncate pr-4">
                                {concept.concept_name}
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-[var(--text-muted)]">Mastery</span>
                                    <span className={cn(
                                        "font-mono font-medium",
                                        concept.mastery_percent < 50 ? "text-[var(--semantic-warning)]" : "text-[var(--brand-primary)]"
                                    )}>
                                        {concept.mastery_percent}%
                                    </span>
                                </div>
                                <Progress
                                    value={concept.mastery_percent}
                                    className="h-1.5 bg-[var(--surface-darker)]"
                                    indicatorClassName={cn(
                                        concept.mastery_percent < 50 ? "bg-[var(--semantic-warning)]" : "bg-[var(--brand-primary)]"
                                    )}
                                />
                            </div>

                            <Button
                                size="sm"
                                className="w-full bg-[var(--surface-darker)] hover:bg-[var(--brand-primary)] hover:text-white text-[var(--text-secondary)] border border-[var(--surface-border)] hover:border-transparent transition-all shadow-none"
                                onClick={() => handleTrain(concept)}
                                disabled={creating}
                            >
                                {creating ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                                ) : (
                                    <Zap className="w-3.5 h-3.5 mr-2" />
                                )}
                                Train Now
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </motion.div>
    );
}

function WeakConceptsSkeleton() {
    return (
        <motion.div variants={slideUpItem} className="w-full mb-8">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-primary/10">
                    <Skeleton className="h-4 w-4" />
                </div>
                <Skeleton className="h-6 w-32" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
            </div>
        </motion.div>
    );
}

function WeakConceptsError() {
    return (
        <motion.div variants={slideUpItem} className="w-full mb-8">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                    <Target className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] font-heading">
                    Focus Areas
                </h2>
            </div>
            <Card className="bg-[var(--surface-card)] border-[var(--surface-border)]">
                <CardContent className="flex items-center gap-3 py-6 text-[var(--text-muted)]">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-sm">Unable to load focus areas. Please refresh to try again.</p>
                </CardContent>
            </Card>
        </motion.div>
    );
}
