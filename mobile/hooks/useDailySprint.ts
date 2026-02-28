import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getErrorMessage } from '../lib/api';
import { analytics } from '../lib/analytics';

export interface SprintStatusResponse {
  status: 'not_started' | 'active' | 'completed';
  session_id?: string | null;
  questions?: SprintQuestion[];
  streak_count: number;
  total_xp: number;
  xp_earned_today: number;
  quiz_credits?: number;
  best_streak?: number;
}

export interface SprintQuestion {
  question_id: string;
  question_number: number;
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'free_text';
  options?: { label: string; value: string }[];
}

export interface SprintAnswerResponse {
  result: {
    is_correct: boolean;
    correct_answer: string;
    explanation?: string | null;
    feedback?: string | null;
  };
  session_complete: boolean;
  xp_awarded?: number;
  mastery_delta?: number;
}

export interface CompleteSprintResponse {
  xp_awarded: number;
  new_total_xp: number;
  new_streak: number;
  streak_maintained: boolean;
}

const SPRINT_KEY = ['/sprint/today'];

function normalizeSprintOptions(questions?: SprintQuestion[]): SprintQuestion[] | undefined {
  return questions?.map((q) => ({
    ...q,
    options: (q.options as any[])?.map((opt, i) =>
      typeof opt === 'string' ? { label: opt, value: opt || String(i) } : opt
    ),
  }));
}

export function useDailySprintStatus() {
  const { data, isLoading, error, refetch } = useQuery<SprintStatusResponse>({
    queryKey: SPRINT_KEY,
    queryFn: async () => {
      const res = await apiFetch<SprintStatusResponse>('/sprint/today');
      return { ...res, questions: normalizeSprintOptions(res.questions) };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    status: data ?? null,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
  };
}

export function useUserStats() {
  const { data, isLoading } = useQuery<SprintStatusResponse>({
    queryKey: SPRINT_KEY,
    queryFn: () => apiFetch<SprintStatusResponse>('/sprint/today'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    streak: data?.streak_count ?? 0,
    totalXp: data?.total_xp ?? 0,
    xpEarnedToday: data?.xp_earned_today ?? 0,
    quizCredits: data?.quiz_credits ?? 0,
    completedToday: data?.status === 'completed',
    isLoading,
  };
}

export function useStartSprint() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ session_id: string; questions: SprintQuestion[] }>('/sprint/start', {
        method: 'POST',
        body: {},
      });
      return { ...res, questions: normalizeSprintOptions(res.questions) ?? [] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SPRINT_KEY });
      analytics.capture('sprint_started', { session_id: data.session_id });
    },
  });

  return {
    startSprint: mutation.mutateAsync,
    starting: mutation.isPending,
    error: mutation.error ? getErrorMessage(mutation.error) : null,
  };
}

export function useSubmitSprintAnswer() {
  const mutation = useMutation({
    mutationFn: ({
      sessionId,
      questionId,
      answer,
    }: { sessionId: string; questionId: string; answer: string }) =>
      apiFetch<SprintAnswerResponse>('/sprint/answer', {
        method: 'POST',
        body: { session_id: sessionId, question_id: questionId, answer },
      }),
    onSuccess: (data, variables) => {
      analytics.capture('question_answered', {
        session_id: variables.sessionId,
        question_id: variables.questionId,
        correct: data.result.is_correct,
        xp_awarded: data.xp_awarded ?? 0,
        mode: 'sprint',
      });
    },
  });

  return {
    submitAnswer: mutation.mutateAsync,
    submitting: mutation.isPending,
    error: mutation.error ? getErrorMessage(mutation.error) : null,
  };
}

export function useCompleteSprint() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      sessionId,
      correctCount,
      totalQuestions,
    }: { sessionId: string; correctCount: number; totalQuestions: number }) =>
      apiFetch<CompleteSprintResponse>('/sprint/complete', {
        method: 'POST',
        body: {
          session_id: sessionId,
          correct_count: correctCount,
          total_questions: totalQuestions,
        },
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: SPRINT_KEY });
      analytics.capture('sprint_completed', {
        session_id: variables.sessionId,
        total_xp: data.new_total_xp,
        streak_count: data.new_streak,
      });
    },
  });

  return {
    completeSprint: mutation.mutateAsync,
    completing: mutation.isPending,
    error: mutation.error ? getErrorMessage(mutation.error) : null,
  };
}
