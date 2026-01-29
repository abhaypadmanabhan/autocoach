"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { ApiError } from "@/lib/types";

export { ApiError } from "@/lib/types";

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
    throw new ApiError(401, "Unauthorized");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(response.status, error.detail || `HTTP ${response.status}`);
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
