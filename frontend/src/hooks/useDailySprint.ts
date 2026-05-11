// Daily-sprint backend retired. Stub keeps HUD layout stable until per-user
// stats endpoint exists.
export function useUserStats() {
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
