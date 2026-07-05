"use client";

import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";
import { v4 as uuidv4 } from "uuid";
import { createBrowserClient } from "@/lib/supabase/client";
import { apiFetch, ApiError } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import type { Document } from "@/lib/types";

interface RegisterDocumentRequest {
  filename: string;
  file_path: string;
  file_type: string;
  file_size: number;
}

type UploadStage = "idle" | "uploading" | "registering" | "complete" | "error";

const ALLOWED_EXTENSIONS = [".pdf", ".pptx"];
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : "";
}

function getFileType(filename: string): "pdf" | "pptx" {
  const ext = getFileExtension(filename);
  return ext === ".pdf" ? "pdf" : "pptx";
}

export function useUploadDocument() {
  const { mutate } = useSWRConfig();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<UploadStage>("idle");

  const uploadDocument = useCallback(
    async (file: File): Promise<Document> => {
      setUploading(true);
      setError(null);
      setProgress(0);
      setStage("idle");

      try {
        // Validate file extension
        const ext = getFileExtension(file.name);
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          throw new Error(
            `Invalid file type. Only ${ALLOWED_EXTENSIONS.join(", ")} files are allowed.`
          );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
        }

        // Get current user
        const supabase = createBrowserClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("You must be logged in to upload documents.");
        }

        // Generate unique file path: userId/uuid-filename
        const fileId = uuidv4();
        const filePath = `${user.id}/${fileId}-${file.name}`;

        // Stage 1: Upload to Supabase Storage
        setStage("uploading");
        setProgress(10);

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          // Handle specific storage errors
          if (uploadError.message?.includes("duplicate")) {
            throw new Error("A file with this name already exists.");
          }
          if (uploadError.message?.includes("payload")) {
            throw new Error(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
          }
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        setProgress(60);

        // Stage 2: Register document with backend
        setStage("registering");

        const registerRequest: RegisterDocumentRequest = {
          filename: file.name,
          file_path: filePath,
          file_type: getFileType(file.name),
          file_size: file.size,
        };

        const document = await apiFetch<Document>("/documents/register", {
          method: "POST",
          body: registerRequest,
        });

        setProgress(100);
        setStage("complete");

        // Invalidate documents list cache
        await mutate("/documents/");

        analytics.capture("document_uploaded", {
          document_id: document.id,
          file_type: document.file_type,
          file_size: document.file_size,
        });

        return document;
      } catch (err) {
        setStage("error");
        let message: string;

        if (err instanceof ApiError) {
          // Backend validation errors
          message = err.message;
        } else if (err instanceof Error) {
          message = err.message;
        } else {
          message = "Failed to upload document. Please try again.";
        }

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
    stage,
  };
}
