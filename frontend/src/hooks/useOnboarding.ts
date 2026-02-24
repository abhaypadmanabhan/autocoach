import useSWR, { useSWRConfig } from "swr";
import { useCallback, useState } from "react";
import { apiFetch, getErrorMessage } from "@/lib/api";

export interface OnboardingData {
    has_completed: boolean;
    learning_topics?: Record<string, unknown> | null;
    goal?: string | null;
    study_frequency?: string | null;
}

export interface OnboardingUpdateRequest {
    learning_topics?: Record<string, unknown>;
    goal?: string;
    study_frequency?: string;
}

const ONBOARDING_KEY = "/onboarding";

export function useOnboarding() {
    const { mutate: globalMutate } = useSWRConfig();
    const [submitting, setSubmitting] = useState(false);

    // Fetch current onboarding status
    const { data, error, isLoading, mutate } = useSWR<OnboardingData>(
        ONBOARDING_KEY,
        () => apiFetch<OnboardingData>(ONBOARDING_KEY),
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false, // Don't retry since 404 is expected if no record exists yet
        }
    );

    const completeOnboarding = useCallback(
        async (payload: OnboardingUpdateRequest): Promise<OnboardingData> => {
            setSubmitting(true);
            try {
                const res = await apiFetch<OnboardingData>(ONBOARDING_KEY, {
                    method: "POST",
                    body: payload,
                });

                // Update local SWR cache
                await mutate(res, false);
                return res;
            } finally {
                setSubmitting(false);
            }
        },
        [mutate]
    );

    return {
        onboarding: data ?? null,
        isLoading,
        submitting,
        error: error ? getErrorMessage(error) : null,
        completeOnboarding,
    };
}
