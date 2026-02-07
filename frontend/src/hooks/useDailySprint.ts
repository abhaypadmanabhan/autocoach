import useSWR, { useSWRConfig } from "swr";
import { useCallback, useState } from "react";
import { apiFetch, getErrorMessage } from "@/lib/api";
import type {
    SprintStatusResponse,
    StartSprintResponse,
    CompleteSprintResponse
} from "@/lib/types";

export function useDailySprint() {
    const { mutate } = useSWRConfig();

    const { data: status, error, isLoading, mutate: refreshStatus } = useSWR<SprintStatusResponse>(
        "/daily-sprint/",
        () => apiFetch<SprintStatusResponse>("/daily-sprint/")
    );

    const [starting, setStarting] = useState(false);
    const [completing, setCompleting] = useState(false);

    const startSprint = useCallback(async () => {
        setStarting(true);
        try {
            const res = await apiFetch<StartSprintResponse>("/daily-sprint/start", {
                method: "POST",
            });
            return res;
        } finally {
            setStarting(false);
        }
    }, []);

    const completeSprint = useCallback(async (
        sessionId: string,
        correctCount: number,
        totalQuestions: number
    ) => {
        setCompleting(true);
        try {
            const res = await apiFetch<CompleteSprintResponse>("/daily-sprint/complete", {
                method: "POST",
                body: {
                    session_id: sessionId,
                    correct_count: correctCount,
                    total_questions: totalQuestions
                }
            });
            // Refresh status to update streak/xp
            await refreshStatus();
            return res;
        } finally {
            setCompleting(false);
        }
    }, [refreshStatus]);

    return {
        status,
        isLoading,
        error: error ? getErrorMessage(error) : null,
        startSprint,
        completeSprint,
        starting,
        completing,
        refreshStatus
    };
}
