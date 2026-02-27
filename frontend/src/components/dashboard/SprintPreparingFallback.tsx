"use client";

import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type SprintPreparingFallbackProps = {
    timedOut: boolean;
    elapsedMs: number;
    retrying: boolean;
    onRetry: () => void;
};

export function SprintPreparingFallback({
    timedOut,
    elapsedMs,
    retrying,
    onRetry,
}: SprintPreparingFallbackProps) {
    const elapsedSeconds = Math.max(1, Math.floor(elapsedMs / 1000));

    if (timedOut) {
        return (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <p className="font-semibold text-amber-200">This is taking longer than expected.</p>
                <p className="mt-1 text-amber-100/80">Your sprint is still being prepared. Try again.</p>
                <Button
                    onClick={onRetry}
                    disabled={retrying}
                    className="mt-3 bg-amber-500 text-amber-950 hover:bg-amber-400"
                >
                    {retrying ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-primary/25 bg-primary/10 p-4 text-sm">
            <div className="flex items-center gap-2 text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="font-semibold">Preparing your sprint...</p>
            </div>
            <p className="mt-1 text-primary/80">We are getting your quiz session ready. ({elapsedSeconds}s)</p>
        </div>
    );
}
