"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2,
    ArrowRight,
    X,
    Trophy,
    Flame,
    Share2,
    CheckCircle2,
    Home,
    AlertCircle
} from "lucide-react";

import { useDailySprint } from "@/hooks/useDailySprint";
import { apiFetch } from "@/lib/api";
import { createBrowserClient } from "@/lib/supabase/client";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { FeedbackPanel } from "@/components/quiz/FeedbackPanel";
import { SentinelMascot } from "@/components/brand/SentinelMascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SprintQuestion, SprintAnswerResult } from "@/lib/types";
import confetti from "canvas-confetti";

// Sprint Completion Screen
function SprintCompletion({
    xp,
    streak,
    message,
    onContinue,
    onShare
}: {
    xp: number;
    streak: number;
    message: string;
    onContinue: () => void;
    onShare: () => void;
}) {
    useEffect(() => {
        // Fire confetti on mount
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#CD776A', '#D4A574', '#E8B86D']
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#CD776A', '#D4A574', '#E8B86D']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();
    }, []);

    return (
        <PageContainer size="md">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center min-h-[80vh] py-12 text-center"
            >
                {/* Mascot Celebration */}
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="relative mb-8"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-500/20 blur-3xl rounded-full scale-150" />
                    <SentinelMascot variant="smiling" className="relative w-48 h-48 md:w-64 md:h-64" />
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500 mb-3"
                >
                    Sprint Complete!
                </motion.h1>

                {/* Message */}
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-lg text-muted-foreground mb-8 max-w-md"
                >
                    {message}
                </motion.p>

                {/* Stats Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-2 gap-4 mb-8 w-full max-w-md"
                >
                    <Card className="p-5 border-none bg-gradient-to-br from-orange-500/10 to-orange-600/5 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <Flame className="w-6 h-6 text-orange-500" />
                        </div>
                        <span className="text-3xl font-bold text-orange-500">{streak}</span>
                        <span className="text-sm text-muted-foreground">Day Streak</span>
                    </Card>

                    <Card className="p-5 border-none bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <Trophy className="w-6 h-6 text-yellow-500" />
                        </div>
                        <span className="text-3xl font-bold text-yellow-500">+{xp}</span>
                        <span className="text-sm text-muted-foreground">XP Earned</span>
                    </Card>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col sm:flex-row gap-3 w-full max-w-md"
                >
                    <Button
                        onClick={onContinue}
                        size="lg"
                        className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-surface-dark font-semibold"
                    >
                        <Home className="w-4 h-4 mr-2" />
                        Continue Learning
                    </Button>

                    <Button
                        variant="outline"
                        size="lg"
                        onClick={onShare}
                        className="flex-1 border-surface-border hover:bg-surface-card"
                    >
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                    </Button>
                </motion.div>
            </motion.div>
        </PageContainer>
    );
}

// Error State
function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div className="h-screen flex flex-col items-center justify-center px-4">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 rounded-full bg-semantic-error/20 flex items-center justify-center mb-6"
            >
                <AlertCircle size={40} className="text-semantic-error" />
            </motion.div>
            <h2 className="text-h2 font-serif text-text-primary mb-2">Something went wrong</h2>
            <p className="text-text-muted mb-6 text-center max-w-md">{message}</p>
            <div className="flex gap-4">
                {onRetry && (
                    <Button onClick={onRetry} variant="outline">
                        Try Again
                    </Button>
                )}
                <Button onClick={() => window.location.href = "/dashboard"}>
                    Back to Dashboard
                </Button>
            </div>
        </div>
    );
}

function SprintContent() {
    const router = useRouter();
    const params = useParams();
    const sessionId = params.sessionId as string;

    const {
        submitAnswer: submitSprintAnswer,
        submittingAnswer,
        completeSprint,
        completing,
        fetchSprintQuestions,
        fetchingQuestions
    } = useDailySprint();

    // Local state for quiz flow
    const [questions, setQuestions] = useState<SprintQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answer, setAnswer] = useState<string>("");
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastResult, setLastResult] = useState<SprintAnswerResult | null>(null);
    const [correctCount, setCorrectCount] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [completionData, setCompletionData] = useState<{
        xp: number;
        streak: number;
        message: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch questions on mount
    useEffect(() => {
        const loadQuestions = async () => {
            if (!sessionId) return;

            try {
                setLoading(true);
                setError(null);

                // We only need to fetch from /sprint/today.
                const status = await apiFetch<{
                    questions?: SprintQuestion[];
                    targets_weak_concepts?: boolean;
                    progress?: { current: number; total: number };
                }>("/sprint/today");

                let sprintQuestions: SprintQuestion[] = [];
                if (status.questions && status.questions.length > 0) {
                    sprintQuestions = status.questions;
                    setIsComplete(false);
                    setQuestions(sprintQuestions);

                    const completedCount = status.progress?.current ?? 0;

                    if (completedCount > 0 && completedCount < sprintQuestions.length) {
                        // We are resuming
                        setCurrentQuestionIndex(completedCount);

                        // Fire analytics event
                        import("@/lib/analytics").then(({ analytics }) => {
                            analytics.capture("quiz_resumed", {
                                session_id: sessionId,
                                progress_current: completedCount,
                                progress_total: sprintQuestions.length
                            });
                        });
                    } else if (completedCount >= sprintQuestions.length) {
                        setIsComplete(true);
                    }
                } else {
                    throw new Error("Could not load sprint questions");
                }

                // Logic handled above

            } catch (err) {
                console.error("Failed to load sprint:", err);
                setError("Failed to load sprint questions. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        loadQuestions();
    }, [sessionId, fetchSprintQuestions]);

    // Auth check
    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) router.push("/login");
        };
        checkAuth();
    }, [router]);

    // Handle Quit
    const handleQuit = () => {
        if (confirm("Quit Daily Sprint? Your progress will be saved.")) {
            router.push("/dashboard");
        }
    };

    const handleSubmit = async () => {
        if (!questions[currentQuestionIndex] || !answer.trim()) return;

        const currentQuestion = questions[currentQuestionIndex];

        try {
            const trimmedAnswer = answer.trim();
            setAnswer(trimmedAnswer);

            // Submit via sprint API
            const result = await submitSprintAnswer(sessionId, currentQuestion.question_id, trimmedAnswer);

            setLastResult(result.result);

            if (result.result.is_correct) {
                setCorrectCount(prev => prev + 1);
            }

            setShowFeedback(true);

            if (result.session_complete || currentQuestionIndex >= questions.length - 1) {
                setIsComplete(true);
            }
        } catch (e) {
            console.error("Failed to submit answer:", e);
        }
    };

    const handleNext = () => {
        setShowFeedback(false);
        setAnswer("");
        setLastResult(null);

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const handleFinishSprint = useCallback(async () => {
        if (!sessionId) return;

        try {
            const finalCorrect = correctCount + (lastResult?.is_correct ? 1 : 0);
            const res = await completeSprint(sessionId, finalCorrect, questions.length);

            setCompletionData({
                xp: res.xp_awarded,
                streak: res.new_streak,
                message: res.message
            });
        } catch (e) {
            console.error("Failed to complete sprint:", e);
        }
    }, [sessionId, correctCount, lastResult, completeSprint, questions.length]);

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'Daily Sprint Complete!',
                text: `I just completed my Daily Sprint with a ${completionData?.streak || 0} day streak and earned ${completionData?.xp || 0} XP!`,
                url: window.location.origin,
            }).catch(() => {
                // User cancelled or share failed
            });
        } else {
            // Copy to clipboard fallback
            const text = `I just completed my Daily Sprint with a ${completionData?.streak || 0} day streak and earned ${completionData?.xp || 0} XP!`;
            navigator.clipboard.writeText(text).then(() => {
                alert('Copied to clipboard!');
            });
        }
    };

    const handleContinueLearning = () => {
        router.push("/dashboard");
    };

    // Show completion screen
    if (completionData) {
        return (
            <SprintCompletion
                xp={completionData.xp}
                streak={completionData.streak}
                message={completionData.message}
                onContinue={handleContinueLearning}
                onShare={handleShare}
            />
        );
    }

    // Error state
    if (error) {
        return <ErrorState message={error} />;
    }

    // Loading state
    if (loading || fetchingQuestions || questions.length === 0) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const totalQuestions = questions.length;

    // Mascot variant based on state
    let mascotVariant: "neutral" | "thinking" | "smiling" | "wrong" = "neutral";
    if (submittingAnswer) mascotVariant = "thinking";
    else if (showFeedback) mascotVariant = lastResult?.is_correct ? "smiling" : "wrong";

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 min-h-screen flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    Daily Sprint
                </span>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleQuit}
                    className="rounded-full hover:bg-destructive/10 hover:text-destructive"
                >
                    <X className="w-5 h-5" />
                </Button>
            </div>

            {/* Single progress — one signal only */}
            <div className="flex gap-1 mb-8">
                {Array.from({ length: totalQuestions }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "h-1 flex-1 rounded-full transition-all duration-500",
                            i < currentQuestionIndex
                                ? "bg-brand-primary"
                                : i === currentQuestionIndex
                                ? "bg-brand-primary/50 animate-pulse"
                                : "bg-surface-border/40"
                        )}
                    />
                ))}
            </div>

            {/* Mascot */}
            <div className="flex justify-center mb-6 h-32 md:h-40">
                <SentinelMascot variant={mascotVariant} className="w-32 h-32 md:w-40 md:h-40" />
            </div>

            {/* Question */}
            <div className="flex-1">
                <QuestionCard
                    number={currentQuestionIndex + 1}
                    question={currentQuestion.question_text}
                    type={currentQuestion.question_type}
                    options={currentQuestion.options || undefined}
                    onAnswer={(val) => setAnswer(val)}
                    selectedAnswer={answer}
                    showFeedback={showFeedback}
                    correctAnswer={lastResult?.correct_answer}
                    isCorrect={lastResult?.is_correct}
                    className="shadow-xl bg-card/50 backdrop-blur-sm border-primary/10"
                />
            </div>

            {/* Submit Button */}
            <div className="mt-8 flex justify-end">
                {!showFeedback ? (
                    <Button
                        size="lg"
                        onClick={handleSubmit}
                        disabled={!answer || submittingAnswer}
                        className="text-lg px-8 py-6 rounded-2xl shadow-lg shadow-primary/20"
                    >
                        {submittingAnswer ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <>Check Answer <ArrowRight className="ml-2 w-5 h-5" /></>
                        )}
                    </Button>
                ) : null}
            </div>

            {/* Feedback Panel */}
            <AnimatePresence>
                {showFeedback && lastResult && (
                    <FeedbackPanel
                        isCorrect={lastResult.is_correct}
                        explanation={lastResult.explanation || undefined}
                        correctAnswer={lastResult.correct_answer}
                        userAnswer={answer}
                        onNext={isComplete ? handleFinishSprint : handleNext}
                        isLastQuestion={isComplete}
                        className="z-50"
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

export default function DailySprintSessionPage() {
    return (
        <AppShell showNav={false} showStatsHUD={false}>
            <Suspense fallback={
                <div className="h-screen flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
                </div>
            }>
                <SprintContent />
            </Suspense>
        </AppShell>
    );
}
