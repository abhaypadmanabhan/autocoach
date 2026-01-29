"use client";

import useSWR from "swr";
import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";
import { apiFetch, normalizeAnswer, getErrorMessage } from "@/lib/api";
import type {
  QuizSession,
  CurrentQuestion,
  QuizSessionCreateRequest,
  AnswerResponse,
  InputMethod,
} from "@/lib/types";

export function useQuizSession(sessionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<QuizSession>(
    sessionId ? `/quiz/sessions/${sessionId}` : null,
    () => apiFetch<QuizSession>(`/quiz/sessions/${sessionId}`),
    { revalidateOnFocus: false }
  );
  return {
    session: data ?? null,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    mutate,
    loading: isLoading,
    refetch: mutate,
  };
}

export function useCurrentQuestion(sessionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<CurrentQuestion | null>(
    sessionId ? `/quiz/sessions/${sessionId}/current` : null,
    async () => {
      try {
        return await apiFetch<CurrentQuestion>(`/quiz/sessions/${sessionId}/current`);
      } catch (err: unknown) {
        const apiErr = err as { status?: number };
        if (apiErr.status === 404 || apiErr.status === 410) {
          return null; // Session complete
        }
        throw err;
      }
    },
    { revalidateOnFocus: false }
  );
  return {
    question: data ?? null,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    mutate,
    loading: isLoading,
    refetch: mutate,
  };
}

export function useCreateSession() {
  const { mutate: globalMutate } = useSWRConfig();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(
    async (data: QuizSessionCreateRequest): Promise<QuizSession> => {
      setCreating(true);
      setError(null);
      try {
        const response = await apiFetch<QuizSession>("/quiz/sessions/", {
          method: "POST",
          body: data,
        });
        globalMutate(`/quiz/sessions/${response.session_id}`, response, false);
        return response;
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        setError(message);
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [globalMutate]
  );
  return { createSession, creating, error };
}

export function useAnswerQuestion(sessionId: string | null) {
  const { mutate: globalMutate } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitAnswer = useCallback(
    async (questionId: string, answer: unknown, inputMethod: InputMethod = "typed"): Promise<AnswerResponse> => {
      if (!sessionId) throw new Error("No session ID");
      setSubmitting(true);
      setError(null);
      try {
        // Normalize answer to string before sending
        const normalizedAnswer = normalizeAnswer(answer);
        
        // Validate answer is not empty
        if (!normalizedAnswer) {
          throw new Error("Answer cannot be empty");
        }
        
        const response = await apiFetch<AnswerResponse>(
          `/quiz/sessions/${sessionId}/answer?question_id=${questionId}`,
          { method: "POST", body: { answer: normalizedAnswer, input_method: inputMethod } }
        );
        await Promise.all([
          globalMutate(`/quiz/sessions/${sessionId}`),
          globalMutate(`/quiz/sessions/${sessionId}/current`),
        ]);
        return response;
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        setError(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [sessionId, globalMutate]
  );
  return { submitAnswer, submitting, error };
}

// Backward compatibility aliases
export { useQuizSession as useSession };
export { useAnswerQuestion as useSubmitAnswer };
