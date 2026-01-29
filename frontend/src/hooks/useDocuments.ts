"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: "pending" | "processing" | "ready" | "failed";
  created_at: string;
  chunk_count?: number;
  page_count?: number;
  error_message?: string;
}

export interface DocumentListResponse {
  documents: Document[];
}

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data: DocumentListResponse = await apiClient.get("/documents/");
      setDocuments(data.documents);
    } catch (err: any) {
      setError(err.message || "Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, error, refetch: fetchDocuments };
}

export function useDocument(id: string | null) {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocument = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      const data: Document = await apiClient.get(`/documents/${id}`);
      setDocument(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch document");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  return { document, loading, error, refetch: fetchDocument };
}

export function useUploadDocument() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File): Promise<Document> => {
    try {
      setUploading(true);
      setError(null);
      setProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      // Simulate progress since fetch doesn't support progress natively
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const response: Document = await apiClient.postFormData("/documents/upload", formData);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      return response;
    } catch (err: any) {
      setError(err.message || "Failed to upload document");
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error, progress };
}

export function usePollDocumentStatus(id: string | null, interval: number = 3000) {
  const { document, refetch } = useDocument(id);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!id || document?.status === "ready" || document?.status === "failed") {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const pollInterval = setInterval(() => {
      refetch();
    }, interval);

    return () => clearInterval(pollInterval);
  }, [id, document?.status, interval, refetch]);

  return { document, isPolling };
}
