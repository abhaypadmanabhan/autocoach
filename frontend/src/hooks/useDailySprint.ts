import useSWR from "swr";
import { useCallback, useRef, useState } from "react";
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

type SprintAnswerApiResponse = {
    correct: boolean;
    explanation?: string | null;
    feedback?: string | null;
    correct_answer?: string | null;
    next_question_id?: string | null;
    next_question_number?: number | null;
    session_complete: boolean;
    xp_awarded?: number;
    mastery_delta?: number;
    mastery_improved_concept_ids?: string[];
    is_repeat_submission?: boolean;
};

export function useDailySprint() {
    const capturedQuestionEventsRef = useRef<Set<string>>(new Set());
    const capturedSprintCompleteEventsRef = useRef<Set<string>>(new Set());
    const masteryImprovedConceptsRef = useRef<Set<string>>(new Set());

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

            capturedQuestionEventsRef.current.clear();
            capturedSprintCompleteEventsRef.current.delete(res.session_id);
            masteryImprovedConceptsRef.current.clear();

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
        sessionId: string,
        questionId: string,
        answer: string
    ): Promise<SprintAnswerResponse> => {
        setSubmittingAnswer(true);
        try {
            const res = await apiFetch<SprintAnswerApiResponse>("/sprint/answer", {
                method: "POST",
                body: { session_id: sessionId, question_id: questionId, answer },
            });

            for (const conceptId of res.mastery_improved_concept_ids ?? []) {
                masteryImprovedConceptsRef.current.add(conceptId);
            }

            const eventKey = `${sessionId}:${questionId}`;
            if (!res.is_repeat_submission && !capturedQuestionEventsRef.current.has(eventKey)) {
                capturedQuestionEventsRef.current.add(eventKey);
                analytics.capture("question_answered", {
                    session_id: sessionId,
                    question_id: questionId,
                    correct: res.correct,
                    xp_awarded: res.xp_awarded ?? 0,
                    mastery_delta: res.mastery_delta ?? 0,
                    mode: "sprint",
                });
            }

            return {
                result: {
                    is_correct: res.correct,
                    correct_answer: res.correct_answer ?? "",
                    explanation: res.explanation ?? null,
                    feedback: res.feedback ?? null,
                },
                next_question: null,
                session_complete: res.session_complete,
                xp_earned: res.xp_awarded,
                xp_awarded: res.xp_awarded,
                mastery_delta: res.mastery_delta,
                mastery_improved_concept_ids: res.mastery_improved_concept_ids,
                is_repeat_submission: res.is_repeat_submission,
            };
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

            if (res.xp_awarded > 0 && !capturedSprintCompleteEventsRef.current.has(sessionId)) {
                capturedSprintCompleteEventsRef.current.add(sessionId);
                analytics.capture("sprint_completed", {
                    session_id: sessionId,
                    total_xp: res.new_total_xp,
                    streak_count: res.new_streak,
                    mastery_improved_concepts: masteryImprovedConceptsRef.current.size,
                });
            }

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
