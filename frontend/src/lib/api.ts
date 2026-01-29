"use client";

import { createBrowserClient } from "@/lib/supabase/client";

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

  async post(endpoint: string, data?: any) {
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
