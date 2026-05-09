"use client";

import useSWR from "swr";
import { apiFetch } from "@/lib/api";

export interface DueConcept {
  id: string;
  name: string;
  document_id: string;
  mastery_score: number;
  mastery_percent: number;
}

export interface ReviewQueue {
  count: number;
  due_concepts: DueConcept[];
  rules: { mastery_below?: number; stale_days?: number; daily_limit?: number };
}

const KEY = "/review/today?limit=20";

export function useReviewQueue() {
  const { data, error, isLoading, mutate } = useSWR<ReviewQueue>(
    KEY,
    () => apiFetch<ReviewQueue>(KEY),
    {
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    },
  );

  const dailyLimit = data?.rules?.daily_limit ?? 50;
  const dueCount = data?.count ?? 0;
  const dailyLimitHit = dueCount >= dailyLimit;

  return {
    queue: data ?? null,
    dueCount,
    conceptsPreview: data?.due_concepts.slice(0, 5) ?? [],
    dailyLimit,
    dailyLimitHit,
    isLoading,
    error: error ? (error as Error).message : null,
    mutate,
  };
}
