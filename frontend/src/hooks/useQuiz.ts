"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";

export interface QuizSessionCreate {
  document_id: string;
  num_questions: number;
  difficulty: "easy" | "medium" | "hard";
  question_types: string[];
}

export interface Question {
  question_id: string;
  question_number: number;
  total_questions: number;
  question_type: "mcq" | "true_false" | "free_text";
  question_text: string;
  options?: string[];
  difficulty: string;
}

export interface AnswerResult {
  is_correct: boolean;
  correct_answer: string;
  explanation?: string;
  score_so_far: number;
  total_answered: number;
  feedback?: string;
}

export interface AnswerResponse {
  result: AnswerResult;
  next_question: Question | null;
  session_complete: boolean;
}

export interface SessionQuestion {
  question_id: string;
  question_number: number;
  question_type: string;
  question_text: string;
  user_answer: string | null;
  is_correct: boolean | null;
  correct_answer: string;
  explanation?: string;
}

export interface SessionStatus {
  session_id: string;
  document_id: string;
  status: "active" | "completed";
  difficulty: string;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  score_percentage: number | null;
  questions: SessionQuestion[];
  started_at: string;
  completed_at: string | null;
}

export function useCreateSession() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async (data: QuizSessionCreate): Promise<SessionStatus> => {
    try {
      setCreating(true);
      setError(null);
      const response: SessionStatus = await apiClient.post("/quiz/sessions/", data);
      return response;
    } catch (err: any) {
      setError(err.message || "Failed to create session");
      throw err;
    } finally {
      setCreating(false);
    }
  };

  return { createSession, creating, error };
}

export function useSession(sessionId: string | null) {
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);
      const data: SessionStatus = await apiClient.get(`/quiz/sessions/${sessionId}`);
      setSession(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return { session, loading, error, refetch: fetchSession };
}

export function useSubmitAnswer(sessionId: string | null) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitAnswer = async (
    questionId: string,
    answer: string,
    inputMethod: "typed" | "voice" = "typed"
  ): Promise<AnswerResponse> => {
    if (!sessionId) throw new Error("No session ID");

    try {
      setSubmitting(true);
      setError(null);
      
      const response: AnswerResponse = await apiClient.post(
        `/quiz/sessions/${sessionId}/answer?question_id=${questionId}`,
        { answer, input_method: inputMethod }
      );
      
      return response;
    } catch (err: any) {
      setError(err.message || "Failed to submit answer");
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitAnswer, submitting, error };
}

export function useCurrentQuestion(sessionId: string | null) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentQuestion = useCallback(async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);
      const data: Question = await apiClient.get(`/quiz/sessions/${sessionId}/current`);
      setQuestion(data);
    } catch (err: any) {
      // 404 means session is complete
      if (err.message?.includes("404")) {
        setQuestion(null);
      } else {
        setError(err.message || "Failed to fetch current question");
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchCurrentQuestion();
  }, [fetchCurrentQuestion]);

  return { question, loading, error, refetch: fetchCurrentQuestion };
}

export function useSearchDocument(documentId: string | null) {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string, topK: number = 5) => {
    if (!documentId) throw new Error("No document ID");

    try {
      setSearching(true);
      setError(null);
      
      const response = await apiClient.post(`/documents/${documentId}/search`, {
        query,
        top_k: topK,
      });
      
      return response;
    } catch (err: any) {
      setError(err.message || "Search failed");
      throw err;
    } finally {
      setSearching(false);
    }
  };

  return { search, searching, error };
}
