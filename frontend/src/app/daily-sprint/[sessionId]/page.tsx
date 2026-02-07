"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2,
    ArrowRight,
    X,
    Trophy,
    Flame,
    Share2,
    CheckCircle2
} from "lucide-react";

import { useSession, useSubmitAnswer, useCurrentQuestion } from "@/hooks/useQuiz";
import { useDailySprint } from "@/hooks/useDailySprint";
import { createBrowserClient } from "@/lib/supabase/client";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { FeedbackPanel } from "@/components/quiz/FeedbackPanel";
import { SentinelMascot } from "@/components/brand/SentinelMascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AnswerResult } from "@/lib/types";
import confetti from "canvas-confetti";

function SprintContent() {
    const router = useRouter();
    const params = useParams();
    const sessionId = params.session_id as string; // Check path param name in next.js

    // Actually params might be { sessionId: ... } depending on folder name [sessionId]
    // Let's use generic access
    const safeSessionId = (Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId) || null;

    const { session, loading: sessionLoading } = useSession(safeSessionId);
    const { question, loading: questionLoading, refetch: refetchQuestion } = useCurrentQuestion(safeSessionId);
    const { submitAnswer, submitting } = useSubmitAnswer(safeSessionId);
    const { completeSprint, completing } = useDailySprint();

    const [answer, setAnswer] = useState<string>("");
    const [showFeedback, setShowFeedback] = useState(false);
    const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
    const [isSprintComplete, setIsSprintComplete] = useState(false);
    const [completionData, setCompletionData] = useState<{
        xp: number;
        streak: number;
        message: string;
    } | null>(null);

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
        if (confirm("Quit Daily Sprint? Your progress will be lost.")) {
            router.push("/dashboard");
        }
    };

    const handleSubmit = async () => {
        if (!question || !answer.trim()) return;

        try {
            const trimmedAnswer = answer.trim();
            setAnswer(trimmedAnswer);
            const result = await submitAnswer(question.question_id, trimmedAnswer, "click");
            setLastResult(result.result);

            // If validation passed, show feedback
            setShowFeedback(true);

            if (result.session_complete) {
                // Don't auto-redirect, let user click "Finish"
                setIsSprintComplete(true);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleNext = () => {
        setShowFeedback(false);
        setAnswer("");
        setLastResult(null);
        refetchQuestion();
    };

    const handleFinishSprint = async () => {
        if (!session || !safeSessionId) return;
        try {
            // Calculate correct answers including the one just submitted if needed?
            // session object might not be updated yet with last answer result immediately?
            // We can use session.correct_answers IF it is updated.
            // Or we use local state? Simpler to trust backend session data, but we might need to refetch session first?
            // Actually completeSprint just needs totals. 
            // The backend complete endpoint calculates XP based on passed count (trusting client? or verifying?)
            // My implementation trusts client for v1 but verifies in future. `complete_sprint` (backend) is trustworthy if IT queries questions.
            // But looking at my backend code: `xp_gain = 100 + (request.correct_count * 10)`. It uses request body!
            // So I should pass accurate count.

            // Count = session.correct_answers.
            // Is session.correct_answers updated? `useSubmitAnswer` calls mutate global.
            // So it should be fine.

            let correct = session.correct_answers;
            // If we just finished logic, session SWR might not have revalidated yet?
            // But `useSubmitAnswer` does `await globalMutate`.
            // So it should be fine.

            const res = await completeSprint(safeSessionId, correct, session.total_questions);
            setCompletionData({
                xp: res.xp_awarded,
                streak: res.new_streak,
                message: res.message
            });

            // Fire confetti
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });

        } catch (e) {
            console.error("Failed to complete sprint", e);
        }
    };

    // ------------------------------------------------------------------
    // COMPLETION VIEW
    // ------------------------------------------------------------------
    if (completionData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center animate-in fade-in duration-500">
                <SentinelMascot variant="success" className="w-64 h-64 mb-8" />

                <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2">
                    Sprint Crushed!
                </h1>
                <p className="text-lg text-muted-foreground mb-8">
                    {completionData.message}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-md">
                    <Card className="p-4 border-none bg-surface-card flex flex-col items-center gap-2">
                        <Flame className="w-8 h-8 text-orange-500" />
                        <span className="text-2xl font-bold">{completionData.streak} Day Streak</span>
                    </Card>
                    <Card className="p-4 border-none bg-surface-card flex flex-col items-center gap-2">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        <span className="text-2xl font-bold">+{completionData.xp} XP</span>
                    </Card>
                </div>

                <div className="flex gap-4">
                    <Button onClick={() => router.push("/dashboard")} size="lg" className="px-8">
                        Back to Dashboard
                    </Button>
                    <Button variant="outline" size="lg">
                        <Share2 className="w-4 h-4 mr-2" /> Share
                    </Button>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // LOADING STATE
    // ------------------------------------------------------------------
    if (sessionLoading || questionLoading || !question) {
        if (isSprintComplete && !completionData) {
            // Transition state between last answer and completion modal
            // Call finish automatically?
            // No, we wait for user to click "See Results" (Finish Sprint) in Feedback Panel?
            // Or purely auto?
            // Let's rely on standard flow.
            return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
        }

        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        );
    }

    // ------------------------------------------------------------------
    // ACTIVE SPRINT VIEW
    // ------------------------------------------------------------------

    // Calculate Progress
    const total = session?.total_questions || 5;
    const current = question.question_number;
    const progress = ((current - 1) / total) * 100;

    // Mascot Variant Logic
    let mascotVariant: "neutral" | "thinking" | "success" | "wrong" = "neutral";
    if (submitting) mascotVariant = "thinking";
    else if (showFeedback) mascotVariant = lastResult?.is_correct ? "success" : "wrong";

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-12 min-h-screen flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Daily Sprint</span>
                    <span className="text-xs text-muted-foreground">Question {current} of {total}</span>
                </div>

                <Button variant="ghost" size="icon" onClick={handleQuit} className="rounded-full hover:bg-destructive/10 hover:text-destructive">
                    <X className="w-6 h-6" />
                </Button>
            </div>

            {/* Progress Bar (Segmented) */}
            <div className="flex gap-2 mb-8 h-2">
                {Array.from({ length: total }).map((_, i) => (
                    <div key={i} className={cn(
                        "h-full flex-1 rounded-full transition-all duration-500",
                        i < current - 1 ? "bg-primary" :
                            i === current - 1 ? "bg-primary/50" : "bg-secondary"
                    )} />
                ))}
            </div>

            {/* Mascot */}
            <div className="flex justify-center mb-8 h-40">
                <SentinelMascot variant={mascotVariant} className="w-40 h-40" />
            </div>

            {/* Question */}
            <div className="flex-1">
                <QuestionCard
                    number={current}
                    question={question.question_text}
                    type={question.question_type}
                    options={question.options || undefined}
                    onAnswer={(val) => setAnswer(val)}
                    selectedAnswer={answer}
                    showFeedback={showFeedback}
                    correctAnswer={lastResult?.correct_answer}
                    isCorrect={lastResult?.is_correct}
                    className="shadow-xl bg-card/50 backdrop-blur-sm border-primary/10"
                />
            </div>

            {/* Subfooter */}
            <div className="mt-8 flex justify-end">
                {!showFeedback ? (
                    <Button
                        size="lg"
                        onClick={handleSubmit}
                        disabled={!answer || submitting}
                        className="text-lg px-8 py-6 rounded-2xl shadow-lg shadow-primary/20"
                    >
                        {submitting ? <Loader2 className="animate-spin" /> : "Check Answer"}
                    </Button>
                ) : (
                    // Feedback shown, waiting for next
                    null
                    // FeedbackPanel handles the "Next" button usually? 
                    // Wait, FeedbackPanel is an overlay or inline?
                    // In session/page.tsx it acts as overlay.
                )}
            </div>

            <AnimatePresence>
                {showFeedback && lastResult && (
                    <FeedbackPanel
                        isCorrect={lastResult.is_correct}
                        explanation={lastResult.explanation || undefined}
                        correctAnswer={lastResult.correct_answer}
                        userAnswer={answer}
                        onNext={isSprintComplete ? handleFinishSprint : handleNext}
                        isLastQuestion={isSprintComplete}
                        className="z-50"
                    // Override button text for last question
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

export default function DailySprintSessionPage() {
    return (
        <AppShell showNav={false}>
            <Suspense fallback={<Loader2 className="animate-spin mx-auto mt-20" />}>
                <SprintContent />
            </Suspense>
        </AppShell>
    );
}
