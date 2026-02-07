"use client";

import { useDailySprint } from "@/hooks/useDailySprint";
import { SentinelMascot } from "@/components/brand/SentinelMascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Loader2, Zap, CheckCircle2, Flame, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function DailySprintCard() {
    const { status, isLoading, startSprint, starting } = useDailySprint();
    const router = useRouter();

    const handleStart = async () => {
        try {
            const res = await startSprint();
            router.push(`/daily-sprint/${res.session_id}`);
        } catch (err) {
            console.error("Failed to start sprint", err);
            // Ideally show toast
        }
    };

    if (isLoading) {
        return (
            <Card className="relative overflow-hidden border-none bg-gradient-to-br from-card to-background shadow-lg p-6 h-[200px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </Card>
        );
    }

    const isCompleted = status?.status === "completed";
    const streak = status?.streak_count || 0;
    const xp = status?.total_xp || 0;

    return (
        <Card className={cn(
            "relative overflow-hidden border-none shadow-lg transition-all duration-300",
            "bg-gradient-to-br from-[#1a1b1e] to-[#121214] hover:shadow-xl",
            isCompleted ? "border-green-500/20" : "border-primary/20"
        )}>
            <div className="flex flex-col md:flex-row items-center justify-between p-6 md:p-8 gap-6">

                {/* Left Content */}
                <div className="flex-1 space-y-4 text-center md:text-left z-10">
                    <div className="space-y-2">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                                Daily Habit
                            </span>
                            <div className="flex items-center gap-1 text-orange-500">
                                <Flame className="w-4 h-4 fill-orange-500 animate-pulse" />
                                <span className="text-xs font-bold">{streak} Day Streak</span>
                            </div>
                        </div>

                        <h2 className="text-3xl font-bold tracking-tight text-white">
                            {isCompleted ? "Daily Goal Achieved" : "Daily Insight Sprint"}
                        </h2>

                        <p className="text-muted-foreground max-w-md">
                            {isCompleted
                                ? "You've fed your brain today. Come back tomorrow to keep the streak alive!"
                                : "Sharpen your mind with 5 quick questions based on your weakest concepts."}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                        {!isCompleted ? (
                            <Button
                                size="lg"
                                onClick={handleStart}
                                disabled={starting}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                            >
                                {starting ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="mr-2 h-5 w-5" /> Start Sprint
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button variant="outline" className="border-green-500/30 text-green-500 hover:bg-green-500/10 hover:text-green-400 cursor-default">
                                <CheckCircle2 className="mr-2 h-5 w-5" /> Sprint Complete
                            </Button>
                        )}

                        <div className="flex items-center gap-2 text-sm text-zinc-500 font-medium">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            <span>{xp} Total XP</span>
                        </div>
                    </div>
                </div>

                {/* Mascot / Right Visual */}
                <div className="relative w-40 h-40 md:w-56 md:h-56 flex-shrink-0 flex items-center justify-center">
                    {/* Background Glow */}
                    <div className={cn(
                        "absolute inset-0 rounded-full blur-[60px] opacity-20",
                        isCompleted ? "bg-green-500" : "bg-primary"
                    )} />

                    <SentinelMascot
                        variant={isCompleted ? "success" : "neutral"}
                        className="w-full h-full drop-shadow-2xl"
                    />
                </div>
            </div>
        </Card>
    );
}
