import useSWR, { useSWRConfig } from "swr";
import { useCallback, useState } from "react";
import { apiFetch, getErrorMessage } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import type {
    SprintStatusResponse,
    SprintQuiz,
    SprintAnswerResponse,
    CompleteSprintResponse,
    SprintQuestion
} from "@/lib/types";

// Cache key for sprint data
const SPRINT_TODAY_KEY = "/sprint/today";

export function useDailySprint() {
    const { mutate: globalMutate } = useSWRConfig();

    // Fetch sprint status - includes active session info if any
    const { data: status, error, isLoading, mutate: refreshStatus } = useSWR<SprintStatusResponse>(
        SPRINT_TODAY_KEY,
        () => apiFetch<SprintStatusResponse>(SPRINT_TODAY_KEY),
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false,
        }
    );

    const [starting, setStarting] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [submittingAnswer, setSubmittingAnswer] = useState(false);
    const [fetchingQuestions, setFetchingQuestions] = useState(false);

    // Start a new sprint
    const startSprint = useCallback(async (): Promise<SprintQuiz> => {
        setStarting(true);
        try {
            const res = await apiFetch<SprintQuiz>("/sprint/start", {
                method: "POST",
                body: {},
            });
            // Invalidate status cache after starting
            await refreshStatus();

            analytics.capture("sprint_started", {
                session_id: res.session_id
            });

            return res;
        } finally {
            setStarting(false);
        }
    }, [refreshStatus]);

    // Fetch questions for an active sprint session
    const fetchSprintQuestions = useCallback(async (sessionId: string): Promise<SprintQuestion[]> => {
        setFetchingQuestions(true);
        try {
            // The backend returns questions array from the sprint session endpoint
            const res = await apiFetch<{ questions: SprintQuestion[] }>(`/sprint/${sessionId}/questions`);
            return res.questions;
        } finally {
            setFetchingQuestions(false);
        }
    }, []);

    // Submit an answer
    const submitAnswer = useCallback(async (
        questionId: string,
        answer: string
    ): Promise<SprintAnswerResponse> => {
        setSubmittingAnswer(true);
        try {
            const res = await apiFetch<SprintAnswerResponse>("/sprint/answer", {
                method: "POST",
                body: { question_id: questionId, answer },
            });
            return res;
        } finally {
            setSubmittingAnswer(false);
        }
    }, []);

    // Complete the sprint
    const completeSprint = useCallback(async (
        sessionId: string,
        correctCount: number,
        totalQuestions: number
    ): Promise<CompleteSprintResponse> => {
        setCompleting(true);
        try {
            const res = await apiFetch<CompleteSprintResponse>("/sprint/complete", {
                method: "POST",
                body: {
                    session_id: sessionId,
                    correct_count: correctCount,
                    total_questions: totalQuestions
                }
            });
            // Refresh status to update streak/xp
            await refreshStatus();

            analytics.capture("sprint_completed", {
                session_id: sessionId,
                correct_count: correctCount,
                total_questions: totalQuestions,
                xp_earned: res.xp_awarded,
                streak_updated: res.new_streak
            });

            return res;
        } finally {
            setCompleting(false);
        }
    }, [refreshStatus]);

    // Redeem XP for quiz credit
    const redeemXP = useCallback(async (): Promise<{ success: boolean; new_total_xp: number; credits_added: number }> => {
        const res = await apiFetch<{ success: boolean; new_total_xp: number; credits_added: number }>("/xp/redeem", {
            method: "POST",
            body: { amount: 100 },
        });
        await refreshStatus();

        if (res.success) {
            analytics.capture("xp_redeemed", {
                amount: 100,
                new_total_xp: res.new_total_xp,
                credits_added: res.credits_added
            });
        }

        return res;
    }, [refreshStatus]);

    return {
        status,
        isLoading,
        error: error ? getErrorMessage(error) : null,
        startSprint,
        fetchSprintQuestions,
        submitAnswer,
        completeSprint,
        redeemXP,
        starting,
        completing,
        submittingAnswer,
        fetchingQuestions,
        refreshStatus
    };
}

// Hook for user stats (XP + Streak) to display in HUD
export function useUserStats() {
    const { data: status, error, isLoading } = useSWR<SprintStatusResponse>(
        SPRINT_TODAY_KEY,
        () => apiFetch<SprintStatusResponse>(SPRINT_TODAY_KEY),
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false,
            dedupingInterval: 60000, // 1 minute
        }
    );

    return {
        streak: status?.streak_count ?? 0,
        totalXp: status?.total_xp ?? 0,
        xpEarnedToday: status?.xp_earned_today ?? 0,
        quizCredits: status?.quiz_credits ?? 0,
        completedToday: status?.status === "completed",
        isLoading,
        error: error ? getErrorMessage(error) : null,
    };
}
