import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError, getAuthHeaders } from '../lib/api';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface Document {
  id: string;
  filename: string;
  ai_title?: string | null;
  file_type: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  chunk_count?: number;
  created_at: string;
  mastery_percentage?: number;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export function useDocuments() {
  const { data, isLoading, error, refetch } = useQuery<DocumentListResponse>({
    queryKey: ['documents'],
    queryFn: () => apiFetch<DocumentListResponse>('/documents/'),
    refetchInterval: (query) => {
      const docs = query.state.data?.documents;
      if (!docs) return false;
      return docs.some((d) => d.status === 'processing' || d.status === 'pending')
        ? 2000
        : false;
    },
    staleTime: 30_000,
  });

  return {
    documents: data?.documents ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}

export function useDocument(id: string | null) {
  const { data, isLoading, error, refetch } = useQuery<Document>({
    queryKey: ['document', id],
    queryFn: () => apiFetch<Document>(`/documents/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const doc = query.state.data;
      if (!doc) return false;
      return doc.status !== 'ready' && doc.status !== 'failed' ? 2000 : false;
    },
    staleTime: 30_000,
  });

  return {
    document: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (documentId: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${BASE_URL}/documents/${documentId}`,
        { method: 'DELETE', headers }
      );
      if (response.status === 401) throw new ApiError('Unauthorized', 401);
      if (!response.ok && response.status !== 204) {
        const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }
      return documentId;
    },
    onSuccess: (documentId) => {
      queryClient.setQueryData<DocumentListResponse>(['documents'], (old) => {
        if (!old) return old;
        return {
          ...old,
          documents: old.documents.filter((d) => d.id !== documentId),
        };
      });
    },
  });

  return {
    deleteDocument: mutation.mutateAsync,
    deleting: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}
