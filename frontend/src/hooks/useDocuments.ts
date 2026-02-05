"use client";

import { useState, useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { apiFetch, getAuthHeaders } from "@/lib/api";
import type { Document, DocumentListResponse } from "@/lib/types";

export type { Document, DocumentListResponse } from "@/lib/types";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export function useDocuments() {
  const { data, error, isLoading, mutate } = useSWR<DocumentListResponse>(
    "/documents/",
    () => apiFetch<DocumentListResponse>("/documents/"),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      shouldRetryOnError: false,
      errorRetryCount: 1,
    }
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
      // Only poll while document is processing (not on error)
      refreshInterval: (data) =>
        data && data.status !== "ready" && data.status !== "failed" ? 2000 : 0,
      shouldRetryOnError: false,
      errorRetryCount: 1,
      dedupingInterval: 5000,
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

export function useDeleteDocument() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mutate } = useSWRConfig();

  const deleteDocument = useCallback(async (documentId: string) => {
    setDeleting(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BASE_URL}/documents/${documentId}`, {
        method: "DELETE",
        headers,
      });

      if (response.status === 401) {
        window.location.href = "/login";
        throw new Error("Unauthorized");
      }

      if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      // Mutate the documents list cache to remove the deleted document
      mutate(
        "/documents/",
        (current: DocumentListResponse | undefined) => {
          if (!current) return current;
          return {
            ...current,
            documents: current.documents.filter((d) => d.id !== documentId),
          };
        },
        { revalidate: false }
      );

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete document";
      setError(message);
      throw err;
    } finally {
      setDeleting(false);
    }
  }, [mutate]);

  return { deleteDocument, deleting, error };
}
