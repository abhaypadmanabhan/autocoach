import useSWR from "swr";
import { useCallback, useEffect, useRef, useState } from "react";
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
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 30000;

type SessionStartSource = "direct_start" | "polling_fallback";

type StartSprintFallbackResult = {
    sessionId: string | null;
    timedOut: boolean;
};

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
    const startedEventSessionsRef = useRef<Set<string>>(new Set());
    const activePollRunRef = useRef(0);
    const activeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);

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
    const [preparing, setPreparing] = useState(false);
    const [prepareTimedOut, setPrepareTimedOut] = useState(false);
    const [prepareElapsedMs, setPrepareElapsedMs] = useState(0);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            activePollRunRef.current += 1;
            if (activeTimerRef.current) {
                clearTimeout(activeTimerRef.current);
                activeTimerRef.current = null;
            }
        };
    }, []);

    const markQuizSessionStarted = useCallback(
        (sessionId: string, source: SessionStartSource, waitMs: number) => {
            if (startedEventSessionsRef.current.has(sessionId)) {
                return;
            }

            startedEventSessionsRef.current.add(sessionId);
            analytics.capture("quiz_session_started", {
                session_id: sessionId,
                mode: "sprint",
                source,
                wait_ms: waitMs,
            });
        },
        []
    );

    const pollForReadySession = useCallback(async (): Promise<StartSprintFallbackResult> => {
        if (activeTimerRef.current) {
            clearTimeout(activeTimerRef.current);
            activeTimerRef.current = null;
        }

        const runId = activePollRunRef.current + 1;
        activePollRunRef.current = runId;

        if (isMountedRef.current) {
            setPreparing(true);
            setPrepareTimedOut(false);
            setPrepareElapsedMs(0);
        }

        const startedAt = Date.now();
        const maxAttempts = Math.floor(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

        for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
            if (!isMountedRef.current || activePollRunRef.current !== runId) {
                return { sessionId: null, timedOut: false };
            }

            try {
                const latestStatus = await apiFetch<SprintStatusResponse>(SPRINT_TODAY_KEY);
                const hasReadySession =
                    latestStatus.status === "active" &&
                    !!latestStatus.session_id &&
                    (latestStatus.questions?.length ?? 0) > 0;

                if (hasReadySession) {
                    await refreshStatus();
                    const waitMs = Date.now() - startedAt;
                    markQuizSessionStarted(
                        latestStatus.session_id as string,
                        "polling_fallback",
                        waitMs
                    );

                    if (isMountedRef.current && activePollRunRef.current === runId) {
                        setPreparing(false);
                        setPrepareTimedOut(false);
                        setPrepareElapsedMs(waitMs);
                    }

                    return {
                        sessionId: latestStatus.session_id as string,
                        timedOut: false,
                    };
                }
            } catch {
                // keep polling until timeout window is exhausted
            }

            if (attempt === maxAttempts) {
                break;
            }

            await new Promise<void>((resolve) => {
                activeTimerRef.current = setTimeout(() => {
                    activeTimerRef.current = null;
                    resolve();
                }, POLL_INTERVAL_MS);
            });

            if (isMountedRef.current && activePollRunRef.current === runId) {
                setPrepareElapsedMs(Date.now() - startedAt);
            }
        }

        if (isMountedRef.current && activePollRunRef.current === runId) {
            setPreparing(false);
            setPrepareTimedOut(true);
            setPrepareElapsedMs(POLL_TIMEOUT_MS);
        }

        return {
            sessionId: null,
            timedOut: true,
        };
    }, [markQuizSessionStarted, refreshStatus]);

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

    const startSprintWithFallback = useCallback(async (): Promise<StartSprintFallbackResult> => {
        let startedSprint: SprintQuiz | null = null;

        if (isMountedRef.current) {
            setPrepareTimedOut(false);
            setPrepareElapsedMs(0);
        }

        try {
            startedSprint = await startSprint();
        } catch (error: unknown) {
            const typedError = error as { status?: number; response?: { status?: number } };
            const statusCode = typedError?.status ?? typedError?.response?.status;

            if (statusCode === 429) {
                throw error;
            }
        }

        if (startedSprint?.session_id && (startedSprint.questions?.length ?? 0) > 0) {
            markQuizSessionStarted(startedSprint.session_id, "direct_start", 0);
            return {
                sessionId: startedSprint.session_id,
                timedOut: false,
            };
        }

        return pollForReadySession();
    }, [markQuizSessionStarted, pollForReadySession, startSprint]);

    const retryPrepareSprint = useCallback(async (): Promise<StartSprintFallbackResult> => {
        if (preparing) {
            return {
                sessionId: null,
                timedOut: false,
            };
        }

        return pollForReadySession();
    }, [pollForReadySession, preparing]);

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
        startSprintWithFallback,
        retryPrepareSprint,
        fetchSprintQuestions,
        submitAnswer,
        completeSprint,
        redeemXP,
        starting,
        completing,
        submittingAnswer,
        fetchingQuestions,
        preparing,
        prepareTimedOut,
        prepareElapsedMs,
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
