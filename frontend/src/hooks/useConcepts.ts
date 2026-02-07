"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import type { DocumentConceptsResponse } from "@/lib/types";

export function useDocumentConcepts(documentId: string | null) {
    const { data, error, isLoading, mutate } = useSWR<DocumentConceptsResponse>(
        documentId ? `/documents/${documentId}/concepts` : null,
        () => apiFetch<DocumentConceptsResponse>(`/documents/${documentId}/concepts`, { cache: "no-store" }),
        {
            revalidateOnFocus: true,
            dedupingInterval: 5000,
            shouldRetryOnError: false,
            errorRetryCount: 1,
        }
    );

    return {
        concepts: data?.concepts ?? [],
        isLoading,
        error: error?.message ?? null,
        mutate,
        loading: isLoading,
        refetch: mutate,
    };
}
