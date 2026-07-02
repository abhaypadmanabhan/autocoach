"use client";

import useSWR from "swr";
import { useState, useCallback, useRef } from "react";
import { useSWRConfig } from "swr";
import { apiFetch, normalizeAnswer, getErrorMessage } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import type {
  QuizSession,
  CurrentQuestion,
  QuizSessionCreateRequest,
  AnswerResponse,
  InputMethod,
  NextQuestionResponse,
} from "@/lib/types";

export function useQuizSession(sessionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<QuizSession>(
    sessionId ? `/quiz/sessions/${sessionId}` : null,
    () => apiFetch<QuizSession>(`/quiz/sessions/${sessionId}`),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      errorRetryCount: 1,
      dedupingInterval: 5000,
    }
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
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      errorRetryCount: 1,
      dedupingInterval: 5000,
    }
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

        analytics.capture("quiz_session_created", {
          session_id: response.session_id,
          document_id: data.document_id
        });

        return response;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : getErrorMessage(err);
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

/**
 * Poll the async-eval verdict endpoint for a `text_free` answer.
 *
 * POST /answer returns immediately with `eval_status: "pending"` for free
 * text (the LLM grades off the request path). This resolves once the verdict
 * lands. Each call long-polls up to `waitMs` server-side; grading is ~2s p50,
 * so this typically resolves in one or two round-trips.
 *
 * The answer is already persisted server-side when this runs, so transient
 * poll failures (network blip, 429 from the shared quiz rate limiter, 5xx)
 * are swallowed: they count as a failed attempt and polling continues after a
 * delay. This NEVER throws and never resubmits — a caller-level retry of the
 * POST would dead-end on 400 "Question already answered".
 *
 * Returns the settled verdict, the last still-pending response if the window
 * is exhausted, or `null` if every attempt errored — callers keep their
 * original pending response in the null case and must render the pending
 * state, not a verdict.
 */
async function pollAnswerVerdict(
  sessionId: string,
  questionId: string,
  { waitMs = 5000, maxAttempts = 6 }: { waitMs?: number; maxAttempts?: number } = {},
): Promise<AnswerResponse | null> {
  let last: AnswerResponse | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let delayMs = 300;
    try {
      const verdict = await apiFetch<AnswerResponse>(
        `/quiz/sessions/${sessionId}/answer?question_id=${questionId}&wait_ms=${waitMs}`,
      );
      last = verdict;
      if (verdict.eval_status !== "pending") return verdict;
      delayMs = verdict.retry_after_ms ?? 300;
    } catch {
      // Transient poll error — keep polling; back off a bit harder since the
      // request failed fast (no server-side long-poll happened).
      delayMs = 1000;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return last;
}

export function useAnswerQuestion(sessionId: string | null) {
  const { mutate: globalMutate } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const capturedQuestionAnswersRef = useRef<Set<string>>(new Set());

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

        let response = await apiFetch<AnswerResponse>(
          `/quiz/sessions/${sessionId}/answer?question_id=${questionId}`,
          { method: "POST", body: { answer: normalizedAnswer, input_method: inputMethod } }
        );

        // text_free answers grade asynchronously — wait for the verdict.
        // If polling exhausts its window (or every poll errored) the response
        // stays pending (`is_correct: null`): the UI shows a "still grading"
        // state instead of a wrong verdict. Never rethrow or resubmit here —
        // the answer is already persisted.
        if (response.eval_status === "pending") {
          const settled = await pollAnswerVerdict(sessionId, questionId);
          if (settled) response = settled;
        }

        // Only mutate session data, NOT current question
        // Question will be refetched when user clicks "Next Question"
        await globalMutate(`/quiz/sessions/${sessionId}`);

        const answerEventKey = `${sessionId}:${questionId}`;
        if (!capturedQuestionAnswersRef.current.has(answerEventKey)) {
          capturedQuestionAnswersRef.current.add(answerEventKey);
          analytics.capture("question_answered", {
            session_id: sessionId,
            question_id: questionId,
            input_method: inputMethod,
            correct: response.result.is_correct,
            xp_awarded: response.result.xp_awarded ?? 0,
            mastery_delta: response.result.mastery_delta ?? 0,
            mode: "quiz",
          });
        }

        return response;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : getErrorMessage(err);
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

/**
 * Long-poll the backend for the next adaptive question.
 *
 * After submit_answer returns, the next question is being generated in the
 * background. This hook fetches it via GET /next, retrying on 'preparing'
 * status. Returns one of:
 *   - { status: "ready", question }     → render the question
 *   - { status: "ended", summary }      → take user to results
 *   - { status: "failed", message }     → show retry UI
 */
export function useNextQuestion(sessionId: string | null) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNext = useCallback(
    async (waitMs = 5000): Promise<NextQuestionResponse> => {
      if (!sessionId) throw new Error("No session ID");
      setPending(true);
      setError(null);
      try {
        // Single long-poll. Caller decides whether to retry on 'preparing'.
        const response = await apiFetch<NextQuestionResponse>(
          `/quiz/sessions/${sessionId}/next?wait_ms=${waitMs}`
        );
        return response;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : getErrorMessage(err);
        setError(message);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [sessionId]
  );

  /**
   * Poll until status is terminal (ready/ended/failed) or `maxAttempts` is hit.
   * Each call waits up to `waitMs` server-side, plus a small client-side delay
   * between retries.
   */
  const pollUntilReady = useCallback(
    async (
      opts: { waitMs?: number; maxAttempts?: number } = {},
    ): Promise<NextQuestionResponse> => {
      const waitMs = opts.waitMs ?? 5000;
      const maxAttempts = opts.maxAttempts ?? 4; // ~20s total worst case
      let attempt = 0;
      while (attempt < maxAttempts) {
        attempt += 1;
        const result = await fetchNext(waitMs);
        if (result.status !== "preparing") {
          return result;
        }
        const delay = result.retry_after_ms ?? 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      // Final attempt with a short wait — surface preparing as failure.
      const last = await fetchNext(2000);
      if (last.status === "preparing") {
        return {
          status: "failed",
          error: "timeout",
          message: "Question generation took too long. Please retry.",
        };
      }
      return last;
    },
    [fetchNext]
  );

  return { fetchNext, pollUntilReady, pending, error };
}

// Backward compatibility aliases
export { useQuizSession as useSession };
export { useAnswerQuestion as useSubmitAnswer };
