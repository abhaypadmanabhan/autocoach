import { supabase } from './supabase';
import { router } from 'expo-router';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    for (const key of ['message', 'detail', 'error']) {
      if (typeof obj[key] === 'string') return obj[key] as string;
    }
  }
  return 'An error occurred';
}

export function normalizeAnswer(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.value === 'string') return obj.value.trim();
    if (typeof obj.label === 'string') return obj.label.trim();
  }
  return String(value).trim();
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  isFormData?: boolean;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, isFormData = false } = options;

  const authHeaders = await getAuthHeaders();
  const fetchHeaders: Record<string, string> = { ...authHeaders, ...headers };

  if (!isFormData && method !== 'GET') {
    fetchHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: fetchHeaders,
    body: isFormData
      ? (body as FormData)
      : body
      ? JSON.stringify(body)
      : undefined,
  });

  if (response.status === 401) {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
    throw new ApiError('Unauthorized', 401);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    const detail =
      typeof errorData.detail === 'string' ? errorData.detail : undefined;
    const message =
      typeof errorData.message === 'string' ? errorData.message : undefined;
    const errorMessage = detail || message || `HTTP ${response.status} Error`;
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}

export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    return apiFetch<T>(endpoint);
  },
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return apiFetch<T>(endpoint, { method: 'POST', body: data });
  },
  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    return apiFetch<T>(endpoint, {
      method: 'POST',
      body: formData,
      isFormData: true,
    });
  },
  async delete<T>(endpoint: string): Promise<T> {
    return apiFetch<T>(endpoint, { method: 'DELETE' });
  },
};
