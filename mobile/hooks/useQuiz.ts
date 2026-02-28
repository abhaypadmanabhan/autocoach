import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getErrorMessage } from '../lib/api';
import { analytics } from '../lib/analytics';

export interface QuizSession {
  session_id: string;
  document_id: string;
  status: string;
  total_questions: number;
  correct_answers: number;
  current_question_number: number;
  time_taken_seconds?: number;
}

export interface QuestionOption {
  label: string;
  value: string;
}

export interface CurrentQuestion {
  question_id: string;
  question_number: number;
  total_questions: number;
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'free_text';
  options?: QuestionOption[];
}

export interface AnswerResult {
  is_correct: boolean;
  correct_answer: string;
  explanation?: string | null;
  feedback?: string | null;
  xp_awarded?: number;
  mastery_delta?: number;
}

export interface AnswerResponse {
  result: AnswerResult;
  next_question?: CurrentQuestion | null;
  session_complete: boolean;
}

export interface QuizSessionCreateRequest {
  document_id: string;
  num_questions?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  question_types?: string[];
  focus?: string;
}

export function useQuizSession(sessionId: string | null) {
  const { data, isLoading, error, refetch } = useQuery<QuizSession>({
    queryKey: ['session', sessionId],
    queryFn: () => apiFetch<QuizSession>(`/quiz/sessions/${sessionId}`),
    enabled: !!sessionId,
    refetchOnWindowFocus: false,
  });

  return {
    session: data ?? null,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
  };
}

export function useCurrentQuestion(sessionId: string | null) {
  const { data, isLoading, error, refetch } = useQuery<CurrentQuestion | null>({
    queryKey: ['currentQuestion', sessionId],
    queryFn: async () => {
      try {
        return await apiFetch<CurrentQuestion>(`/quiz/sessions/${sessionId}/current`);
      } catch (err: any) {
        if (err?.status === 404 || err?.status === 410) return null;
        throw err;
      }
    },
    enabled: !!sessionId,
    refetchOnWindowFocus: false,
  });

  return {
    question: data ?? null,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
  };
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: QuizSessionCreateRequest) =>
      apiFetch<QuizSession>('/quiz/sessions/', { method: 'POST', body: data }),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(['session', response.session_id], response);
      analytics.capture('quiz_session_created', {
        session_id: response.session_id,
        document_id: variables.document_id,
      });
    },
  });

  return {
    createSession: mutation.mutateAsync,
    creating: mutation.isPending,
    error: mutation.error ? getErrorMessage(mutation.error) : null,
  };
}

export function useAnswerQuestion(sessionId: string | null) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) =>
      apiFetch<AnswerResponse>(
        `/quiz/sessions/${sessionId}/answer?question_id=${questionId}`,
        { method: 'POST', body: { answer, input_method: 'tapped' } }
      ),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      analytics.capture('question_answered', {
        session_id: sessionId,
        question_id: variables.questionId,
        correct: response.result.is_correct,
        xp_awarded: response.result.xp_awarded ?? 0,
        mastery_delta: response.result.mastery_delta ?? 0,
        mode: 'quiz',
      });
    },
  });

  return {
    submitAnswer: mutation.mutateAsync,
    submitting: mutation.isPending,
    error: mutation.error ? getErrorMessage(mutation.error) : null,
  };
}
