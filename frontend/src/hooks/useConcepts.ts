"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import type { DocumentConceptsResponse } from "@/lib/types";

export function useDocumentConcepts(documentId: string | null) {
    const { data, error, isLoading, mutate } = useSWR<DocumentConceptsResponse>(
        documentId ? `/documents/${documentId}/concepts` : null,
        async () => {
            const response = await apiFetch<DocumentConceptsResponse>(`/documents/${documentId}/concepts`, { cache: "no-store" });
            return response;
        },
        {
            revalidateOnFocus: true,
            dedupingInterval: 5000,
            shouldRetryOnError: false,
            errorRetryCount: 1,
        }
    );

    // Log error once when it occurs
    if (error) {
        console.error("[useDocumentConcepts] Failed to fetch concepts:", error);
    }

    return {
        concepts: data?.concepts ?? [],
        isLoading,
        error: error ?? null,
        refetch: mutate,
    };
}
