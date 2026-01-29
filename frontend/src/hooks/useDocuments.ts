"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import type { Document, DocumentListResponse } from "@/lib/types";

export type { Document, DocumentListResponse } from "@/lib/types";

export function useDocuments() {
  const { data, error, isLoading, mutate } = useSWR<DocumentListResponse>(
    "/documents/",
    () => apiFetch<DocumentListResponse>("/documents/"),
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  return {
    documents: data?.documents ?? [],
    isLoading,
    error: error?.message ?? null,
    mutate,
    // Backward compat
    loading: isLoading,
    refetch: mutate,
  };
}

export function useDocument(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Document>(
    id ? `/documents/${id}` : null,
    () => apiFetch<Document>(`/documents/${id}`),
    {
      refreshInterval: (data) =>
        data && data.status !== "ready" && data.status !== "failed" ? 2000 : 0,
    }
  );

  return {
    document: data ?? null,
    isLoading,
    error: error?.message ?? null,
    mutate,
    // Backward compat
    loading: isLoading,
    refetch: mutate,
  };
}

export function usePollDocumentStatus(id: string | null) {
  const { document, mutate } = useDocument(id);
  const isPolling = document
    ? document.status !== "ready" && document.status !== "failed"
    : false;
  return { document, isPolling, refetch: mutate };
}
