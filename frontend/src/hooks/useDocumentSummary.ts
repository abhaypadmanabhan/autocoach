import useSWR from "swr";
import { apiFetch } from "@/lib/api";

export interface DocumentSummary {
    one_liner: string;
    what_youll_learn: string[];
    key_concepts: string[];
    study_plan: string[];
}

export interface DocumentSummaryResponse {
    document_id: string;
    summary: DocumentSummary;
    generated_at: string;
    version?: string;
}

export function useDocumentSummary(documentId: string | null) {
    const { data, error, isLoading, mutate } = useSWR<DocumentSummaryResponse>(
        documentId ? `/documents/${documentId}/summary` : null,
        () => apiFetch<DocumentSummaryResponse>(`/documents/${documentId}/summary`),
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false, // Don't retry 409s automatically in loop
        }
    );

    return {
        summary: data?.summary,
        meta: data ? { generated_at: data.generated_at, version: data.version } : null,
        isLoading,
        error,
        mutate,
    };
}
