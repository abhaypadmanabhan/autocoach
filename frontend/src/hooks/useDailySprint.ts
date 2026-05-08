// Daily-sprint backend was retired; this module now only exposes the
// XP redeem helper and a zero-valued stats stub so existing UI surfaces
// (the AppShell HUD) keep rendering. A future PR can wire these to the
// real per-user stats endpoint when one exists.

import { useCallback } from "react";
import { apiFetch } from "@/lib/api";

export function useDailySprint() {
    const redeemXP = useCallback(
        async (): Promise<{ success: boolean; new_total_xp: number; credits_added: number }> => {
            const res = await apiFetch<{
                success: boolean;
                new_total_xp: number;
                credits_added: number;
            }>("/xp/redeem", {
                method: "POST",
            });
            return res;
        },
        [],
    );

    return { redeemXP };
}

export function useUserStats() {
    // No backend source for streak/XP/credits since sprint endpoints were
    // deleted. Returning zeros keeps the HUD layout stable.
    return {
        streak: 0,
        totalXp: 0,
        xpEarnedToday: 0,
        quizCredits: 0,
        completedToday: false,
        isLoading: false,
        error: null as string | null,
    };
}
