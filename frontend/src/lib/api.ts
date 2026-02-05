"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { ApiError } from "@/lib/types";

export { ApiError } from "@/lib/types";

/**
 * Normalize any answer value to a string for API submission.
 * Handles: strings, objects with value/label properties, or any other type.
 */
export function normalizeAnswer(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.value === "string") return obj.value.trim();
    if (typeof obj.label === "string") return obj.label.trim();
    // Try to extract value from common property names
    if (typeof obj.text === "string") return obj.text.trim();
    if (typeof obj.answer === "string") return obj.answer.trim();
  }
  return String(value).trim();
}

/**
 * Extract a readable error message from any error value.
 * Prevents "[object Object]" from being displayed in UI.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err === null || err === undefined) return "An unknown error occurred";
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.detail === "string") return obj.detail;
    if (typeof obj.error === "string") return obj.error;
    // Try to get first available string property
    for (const key of ["message", "detail", "error", "statusText"]) {
      if (typeof obj[key] === "string") return obj[key] as string;
    }
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "An error occurred";
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  isFormData?: boolean;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, isFormData = false } = options;

  const authHeaders = await getAuthHeaders();
  const fetchHeaders: Record<string, string> = { ...authHeaders, ...headers };

  if (!isFormData && method !== "GET") {
    fetchHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: fetchHeaders,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    window.location.href = "/login";
    throw new ApiError("Unauthorized", 401);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
    const detail = typeof errorData.detail === "string" ? errorData.detail : undefined;
    const message = typeof errorData.message === "string" ? errorData.message : undefined;
    const code = typeof errorData.code === "string" ? errorData.code : undefined;
    const errorMessage = detail || message || `HTTP ${response.status} Error`;
    throw new ApiError(errorMessage, response.status, code, errorData);
  }

  return response.json();
}

export const apiClient = {
  async get(endpoint: string) {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async post(endpoint: string, data?: unknown) {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (response.status === 401) {
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async postFormData(endpoint: string, formData: FormData) {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        ...headers,
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData,
    });

    if (response.status === 401) {
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  },

  async delete(endpoint: string) {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "DELETE",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  },
};
