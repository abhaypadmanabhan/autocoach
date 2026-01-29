export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  created_at: string;
  chunk_count?: number;
  page_count?: number;
  error_message?: string;
}

export interface DocumentListResponse {
  documents: Document[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}
