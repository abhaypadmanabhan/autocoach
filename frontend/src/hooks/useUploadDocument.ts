"use client";

import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";
import { apiFetch, ApiError } from "@/lib/api";
import type { Document } from "@/lib/types";

export function useUploadDocument() {
  const { mutate } = useSWRConfig();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadDocument = useCallback(
    async (file: File): Promise<Document> => {
      setUploading(true);
      setError(null);
      setProgress(0);

      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const document = await apiFetch<Document>("/documents/upload", {
          method: "POST",
          body: formData,
          isFormData: true,
        });

        clearInterval(progressInterval);
        setProgress(100);
        await mutate("/documents/"); // Invalidate list cache
        return document;
      } catch (err) {
        clearInterval(progressInterval);
        const message =
          err instanceof ApiError ? err.message : "Failed to upload";
        setError(message);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [mutate]
  );

  return {
    uploadDocument,
    upload: uploadDocument, // backward compat
    uploading,
    error,
    progress,
  };
}
