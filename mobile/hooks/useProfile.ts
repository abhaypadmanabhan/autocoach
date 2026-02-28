import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { apiFetch, getErrorMessage } from '../lib/api';

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  total_xp?: number;
  streak_count?: number;
  best_streak?: number;
  experience_level?: string;
  study_goal?: string;
}

export interface OnboardingData {
  experience_level?: string;
  study_frequency?: string;
  goals?: string[];
}

export function useProfile() {
  const { data, isLoading, error, refetch } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      return {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name ?? user.user_metadata?.full_name,
        avatar_url: profile?.avatar_url,
        total_xp: profile?.total_xp ?? 0,
        streak_count: profile?.streak_count ?? 0,
        best_streak: profile?.best_streak ?? 0,
        experience_level: profile?.experience_level,
        study_goal: profile?.study_goal,
      };
    },
    staleTime: 60_000,
  });

  return {
    profile: data ?? null,
    isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch,
  };
}

export function useOnboarding() {
  const { data, isLoading, error } = useQuery<OnboardingData>({
    queryKey: ['onboarding'],
    queryFn: () => apiFetch<OnboardingData>('/onboarding'),
    staleTime: 300_000,
  });

  return {
    onboarding: data ?? null,
    isLoading,
    error: error ? getErrorMessage(error) : null,
  };
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      await supabase.auth.signOut();
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });

  return {
    signOut: mutation.mutateAsync,
    loading: mutation.isPending,
  };
}
