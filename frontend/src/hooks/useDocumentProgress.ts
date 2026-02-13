import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

export interface DocumentProgress {
    document_id: string;
    document_title: string | null;
    mastery_percent: number;
    concepts_total: number;
    concepts_practiced: number;
    weak_concepts_count: number;
    mastered_concepts_count: number;
    milestone: 'none' | '25' | '50' | '75' | '100';
}

export interface DocumentProgressSummary {
    documents: DocumentProgress[];
}

export function useDocumentProgress(documentId: string) {
    const { data, error, isLoading, mutate } = useSWR<DocumentProgress>(
        documentId ? `/documents/${documentId}/progress` : null,
        (url: string) => apiFetch<DocumentProgress>(url)
    );

    return {
        progress: data,
        isLoading,
        isError: error,
        mutate,
    };
}

export function useDocumentProgressSummary() {
    const { data, error, isLoading, mutate } = useSWR<DocumentProgressSummary>(
        '/documents/progress/summary',
        (url: string) => apiFetch<DocumentProgressSummary>(url)
    );

    return {
        summary: data,
        isLoading,
        isError: error,
        mutate,
    };
}
