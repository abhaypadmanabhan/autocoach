"use client";

import { useDailySprint } from "@/hooks/useDailySprint";
import { SentinelMascot } from "@/components/brand/SentinelMascot";
import { SprintPreparingFallback } from "@/components/dashboard/SprintPreparingFallback";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { Loader2, Zap, CheckCircle2, Flame, Trophy, Target, Sparkles, Play, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function DailySprintCard() {
    const {
        status,
        isLoading,
        startSprintWithFallback,
        retryPrepareSprint,
        starting,
        preparing,
        prepareTimedOut,
        prepareElapsedMs,
    } = useDailySprint();
    const router = useRouter();
    const { showToast } = useToast();
    const [limitReached, setLimitReached] = useState(false);

    const isCompleted = status?.status === "completed";
    const isActive = status?.status === "active";
    const streak = status?.streak_count ?? 0;
    const xp = status?.total_xp ?? 0;
    const xpEarnedToday = status?.xp_earned_today ?? 0;

    const progressCurrent = status?.progress?.current ?? 0;
    const progressTotal = status?.progress?.total ?? 5;

    const targetsWeak = status?.targets_weak_concepts;
    const focusLabel = targetsWeak
        ? { text: "Weak spots", icon: Target, color: "text-orange-400 bg-orange-400/10" }
        : { text: "Core concepts", icon: Sparkles, color: "text-blue-400 bg-blue-400/10" };
    const FocusIcon = focusLabel.icon;

    const handleStart = async () => {
        if (isActive && status?.session_id) {
            router.push(`/daily-sprint/${status.session_id}`);
            return;
        }

        try {
            const result = await startSprintWithFallback();
            if (result.sessionId) {
                router.push(`/daily-sprint/${result.sessionId}`);
            }
        } catch (err: unknown) {
            console.error("Failed to start sprint", err);
            const typedErr = err as { status?: number; response?: { status?: number }; message?: string };
            if (
                typedErr?.status === 429 ||
                typedErr?.response?.status === 429 ||
                typedErr?.message?.includes("limit")
            ) {
                setLimitReached(true);
                showToast("Daily limit reached. Come back tomorrow.", "error");
            } else {
                showToast("Failed to start sprint. Try again!", "error");
            }
        }
    };

    const handleRetry = async () => {
        try {
            const result = await retryPrepareSprint();
            if (result.sessionId) {
                router.push(`/daily-sprint/${result.sessionId}`);
                return;
            }
            if (result.timedOut) {
                showToast("Still preparing your sprint. Please try again shortly.", "error");
            }
        } catch {
            showToast("Failed to retry sprint preparation.", "error");
        }
    };

    const getTitle = () => {
        if (limitReached) return "Daily limit reached";
        if (preparing) return "Preparing sprint...";
        if (prepareTimedOut) return "Sprint preparation delayed";
        if (isCompleted) return "Goal Achieved!";
        if (isActive) return `Resume (${progressCurrent}/${progressTotal})`;
        return "Today's Sprint";
    };

    const getSubtitle = () => {
        if (limitReached) return "Come back tomorrow to continue your streak.";
        if (preparing) return "Setting up your questions...";
        if (prepareTimedOut) return "Still preparing. Retry to check.";
        if (isCompleted) return `${xpEarnedToday} XP earned. Keep the streak going!`;
        if (isActive) return "Continue where you left off.";
        return "5 quick questions to sharpen your mind.";
    };

    const getCtaConfig = () => {
        if (limitReached) {
            return {
                text: "Tomorrow",
                icon: <Clock className="mr-2 h-4 w-4" />,
                disabled: true,
                variant: "outline" as const
            };
        }
        if (isCompleted) return null;

        if (starting || preparing) {
            return {
                text: preparing ? "Preparing..." : "Starting...",
                icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" />,
                disabled: true,
                variant: "default" as const
            };
        }

        if (isActive) {
            return {
                text: "Resume",
                icon: <Play className="mr-2 h-4 w-4" />,
                disabled: false,
                variant: "default" as const
            };
        }

        return {
            text: "Start",
            icon: <Zap className="mr-2 h-4 w-4" />,
            disabled: false,
            variant: "default" as const
        };
    };

    const ctaConfig = getCtaConfig();
    const showPreparingFallback = preparing || prepareTimedOut;

    if (isLoading) {
        return (
            <div className="relative overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)]/50 backdrop-blur-sm p-8 h-[180px] flex items-center justify-center">
                <div className="absolute inset-0 warm-aurora-bg-subtle" />
                <Loader2 className="w-6 h-6 animate-spin text-[var(--pop-coral)] relative z-10" />
            </div>
        );
    }

    return (
        <div className={cn(
            "relative overflow-hidden rounded-2xl border border-[var(--surface-border)]",
            "bg-[var(--surface-card)]/40 backdrop-blur-sm",
            "transition-all duration-300 group",
            isCompleted ? "border-green-500/20" : "hover:border-[var(--pop-coral)]/30"
        )}>
            {/* Warm aurora background */}
            <div className="absolute inset-0 warm-aurora-bg-subtle" />

            {/* Accent gradient line at top */}
            <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                    background: isCompleted
                        ? "linear-gradient(90deg, transparent, var(--semantic-success), transparent)"
                        : "linear-gradient(90deg, transparent, var(--pop-coral), var(--pop-gold), transparent)"
                }}
            />

            {/* Glow effect on hover */}
            <div
                className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                    "bg-gradient-to-br from-[var(--pop-coral)]/5 via-transparent to-[var(--pop-gold)]/5"
                )}
            />

            <div className="relative z-10 p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

                    {/* Left Content */}
                    <div className="flex-1 space-y-4">
                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-[var(--pop-coral)]/10 text-[var(--pop-coral)] text-xs font-bold uppercase tracking-wider">
                                Daily Sprint
                            </span>

                            <div className="flex items-center gap-1 text-orange-500">
                                <Flame className="w-3.5 h-3.5 fill-orange-500" />
                                <span className="text-xs font-bold">{streak}</span>
                            </div>

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

                        {/* Title & Subtitle */}
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)] font-heading">
                                {getTitle()}
                            </h2>
                            <p className="text-sm text-[var(--text-secondary)]">
                                {getSubtitle()}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-4 pt-2">
                            {showPreparingFallback && (
                                <SprintPreparingFallback
                                    timedOut={prepareTimedOut}
                                    elapsedMs={prepareElapsedMs}
                                    retrying={preparing}
                                    onRetry={handleRetry}
                                />
                            )}

                            {!isCompleted && ctaConfig && !showPreparingFallback && (
                                <Button
                                    size="sm"
                                    onClick={handleStart}
                                    disabled={ctaConfig.disabled}
                                    variant={ctaConfig.variant}
                                    className={cn(
                                        "font-semibold transition-all",
                                        ctaConfig.disabled
                                            ? "opacity-50 cursor-not-allowed"
                                            : "bg-gradient-to-r from-[var(--pop-coral)] to-[var(--pop-gold)] text-white hover:shadow-lg hover:shadow-[var(--pop-coral)]/20"
                                    )}
                                >
                                    {ctaConfig.icon}
                                    {ctaConfig.text}
                                </Button>
                            )}

                            {isCompleted && (
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    <span className="text-sm text-green-500 font-medium">Complete</span>
                                    {xpEarnedToday > 0 && (
                                        <span className="text-sm text-[var(--pop-gold)] font-medium">
                                            +{xpEarnedToday} XP
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                <Trophy className="w-3.5 h-3.5 text-[var(--pop-gold)]" />
                                <span>{xp.toLocaleString()} XP</span>
                            </div>
                        </div>
                    </div>

                    {/* Mascot */}
                    <div className="relative w-28 h-28 flex-shrink-0">
                        <div
                            className={cn(
                                "absolute inset-0 rounded-full blur-[40px] opacity-20",
                                isCompleted ? "bg-green-500" : isActive ? "bg-orange-500" : "bg-[var(--pop-coral)]"
                            )}
                        />
                        <SentinelMascot
                            variant={isCompleted ? "smiling" : isActive ? "thinking" : "neutral"}
                            className="w-full h-full"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
