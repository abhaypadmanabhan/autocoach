"use client";

import { useDailySprint } from "@/hooks/useDailySprint";
import { SentinelMascot } from "@/components/brand/SentinelMascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { Loader2, Zap, CheckCircle2, Flame, Trophy, Target, Sparkles, Play, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function DailySprintCard() {
    const { status, isLoading, startSprint, starting } = useDailySprint();
    const router = useRouter();
    const { showToast } = useToast();
    const [limitReached, setLimitReached] = useState(false);

    // Determine sprint state
    const isCompleted = status?.status === "completed";
    const isActive = status?.status === "active";
    const isReady = status?.status === "ready" || !status?.status;

    // User stats
    const streak = status?.streak_count ?? 0;
    const xp = status?.total_xp ?? 0;
    const xpEarnedToday = status?.xp_earned_today ?? 0;

    // Progress for active sprint
    const progressCurrent = status?.progress?.current ?? 0;
    const progressTotal = status?.progress?.total ?? 5;

    // Focus messaging (only show for non-completed states)
    const targetsWeak = status?.targets_weak_concepts;
    const focusLabel = targetsWeak
        ? { text: "Focused on weak spots", icon: Target, color: "text-orange-400 bg-orange-400/10" }
        : { text: "Core concepts today", icon: Sparkles, color: "text-blue-400 bg-blue-400/10" };
    const FocusIcon = focusLabel.icon;

    // Handle CTA click
    const handleStart = async () => {
        // If there's an active session, resume it
        if (isActive && status?.session_id) {
            router.push(`/daily-sprint/${status.session_id}`);
            return;
        }

        // Otherwise start a new sprint
        try {
            const quiz = await startSprint();
            router.push(`/daily-sprint/${quiz.session_id}`);
        } catch (err: any) {
            console.error("Failed to start sprint", err);
            // Check for 429 limit reached
            if (err?.status === 429 || err?.response?.status === 429 || err?.message?.includes("limit")) {
                setLimitReached(true);
                showToast("Daily limit reached. Come back tomorrow.", "error");
            } else {
                showToast("Failed to start sprint. Try again!", "error");
            }
        }
    };

    // Get title based on state
    const getTitle = () => {
        if (limitReached) return "Daily limit reached";
        if (isCompleted) return "Daily Goal Achieved!";
        if (isActive) return `Resume Sprint (${progressCurrent}/${progressTotal})`;
        return "Start Today's Sprint (5Q)";
    };

    // Get subtitle based on state
    const getSubtitle = () => {
        if (limitReached) {
            return "Come back tomorrow to continue your streak.";
        }
        if (isCompleted) {
            return `You've earned ${xpEarnedToday} XP today. Come back tomorrow to keep your streak alive!`;
        }
        if (isActive) {
            return `You have a sprint in progress. Finish it to keep your streak!`;
        }
        return "Sharpen your mind with 5 quick questions. Daily consistency builds lasting knowledge.";
    };

    // Get CTA button config
    const getCtaConfig = () => {
        if (limitReached) {
            return {
                text: "Come back tomorrow",
                icon: <Clock className="mr-2 h-5 w-5" />,
                disabled: true,
                variant: "outline" as const
            };
        }
        if (isCompleted) return null; // No CTA for completed state

        if (starting) {
            return {
                text: isActive ? "Resuming..." : "Starting...",
                icon: <Loader2 className="mr-2 h-5 w-5 animate-spin" />,
                disabled: true,
                variant: "default" as const
            };
        }

        if (isActive) {
            return {
                text: "Resume Sprint",
                icon: <Play className="mr-2 h-5 w-5" />,
                disabled: false,
                variant: "default" as const
            };
        }

        return {
            text: "Start Sprint",
            icon: <Zap className="mr-2 h-5 w-5" />,
            disabled: false,
            variant: "default" as const
        };
    };

    const ctaConfig = getCtaConfig();

    return isLoading ? (
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-card to-background shadow-lg p-6 h-[200px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </Card>
    ) : (
        <Card className={cn(
            "relative overflow-hidden border-none shadow-lg transition-all duration-300",
            "bg-gradient-to-br from-[#1a1b1e] to-[#121214] hover:shadow-xl",
            isCompleted ? "border-green-500/20" : "border-primary/20"
        )}>
            <div className="flex flex-col md:flex-row items-center justify-between p-6 md:p-8 gap-6">

                {/* Left Content */}
                <div className="flex-1 space-y-4 text-center md:text-left z-10">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                                Daily Sprint
                            </span>

                            {/* Streak Badge */}
                            <div className="flex items-center gap-1 text-orange-500">
                                <Flame className="w-4 h-4 fill-orange-500" />
                                <span className="text-xs font-bold">{streak} Day Streak</span>
                            </div>

                            {/* Focus Label - hide when completed */}
                            {!isCompleted && (
                                <span className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                    focusLabel.color
                                )}>
                                    <FocusIcon className="w-3 h-3" />
                                    {focusLabel.text}
                                </span>
                            )}
                        </div>

                        <h2 className="text-3xl font-bold tracking-tight text-white">
                            {getTitle()}
                        </h2>

                        <p className="text-muted-foreground max-w-md">
                            {getSubtitle()}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                        {/* CTA Button */}
                        {!isCompleted && ctaConfig && (
                            <Button
                                size="lg"
                                onClick={handleStart}
                                disabled={ctaConfig.disabled}
                                variant={ctaConfig.variant}
                                className={cn(
                                    "font-semibold px-8 transition-all",
                                    ctaConfig.disabled
                                        ? "opacity-60 cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground"
                                        : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
                                )}
                            >
                                {ctaConfig.icon}
                                {ctaConfig.text}
                            </Button>
                        )}

                        {/* Completed State */}
                        {isCompleted && (
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                    variant="outline"
                                    className="border-green-500/30 text-green-500 hover:bg-green-500/10 hover:text-green-400 cursor-default"
                                >
                                    <CheckCircle2 className="mr-2 h-5 w-5" /> Sprint Complete
                                </Button>

                                {/* XP Earned Today Badge */}
                                {xpEarnedToday > 0 && (
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-500">
                                        <Trophy className="w-4 h-4" />
                                        <span className="text-sm font-semibold">+{xpEarnedToday} XP today</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Total XP */}
                        <div className="flex items-center gap-2 text-sm text-zinc-500 font-medium">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            <span>{xp.toLocaleString()} Total XP</span>
                        </div>
                    </div>
                </div>

                {/* Mascot / Right Visual */}
                <div className="relative w-40 h-40 md:w-56 md:h-56 flex-shrink-0 flex items-center justify-center">
                    {/* Background Glow */}
                    <div className={cn(
                        "absolute inset-0 rounded-full blur-[60px] opacity-20",
                        isCompleted ? "bg-green-500" : isActive ? "bg-orange-500" : "bg-primary"
                    )} />

                    <SentinelMascot
                        variant={isCompleted ? "smiling" : isActive ? "thinking" : "neutral"}
                        className="w-full h-full drop-shadow-2xl"
                    />
                </div>
            </div>
        </Card>
    );
}
