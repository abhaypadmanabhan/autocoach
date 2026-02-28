import { useQuery } from '@tanstack/react-query';
import { apiFetch, getErrorMessage } from '../lib/api';

export interface Concept {
  id: string;
  name: string;
  mastery_percentage: number;
  document_id?: string;
  last_practiced?: string;
}

export function useWeakConcepts(limit = 3) {
  const { data, isLoading, error } = useQuery<Concept[]>({
    queryKey: ['concepts', 'weak', limit],
    queryFn: () => apiFetch<Concept[]>(`/concepts/weakest?limit=${limit}`),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    concepts: data ?? [],
    isLoading,
    error: error ? getErrorMessage(error) : null,
  };
}
