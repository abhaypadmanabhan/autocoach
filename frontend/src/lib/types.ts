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
  ai_title?: string;
  progress?: number;
  session_id?: string;
  concept_count?: number;
}

export interface DocumentListResponse {
  documents: Document[];
}

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Quiz types
export type QuestionType = "text_mcq" | "text_tf" | "text_free" | "rendered";
export type Difficulty = "easy" | "medium" | "hard";
export type QuizSessionStatus = "active" | "completed";
export type InputMethod = "typed" | "click" | "voice";

export interface CurrentQuestion {
  question_id: string;
  question_number: number;
  total_questions: number;
  question_type: QuestionType;
  question_text: string;
  options?: string[] | null;
  difficulty: Difficulty;
}

export interface SessionQuestionDetail {
  question_id: string;
  question_number: number;
  question_type: QuestionType;
  question_text: string;
  user_answer: string | null;
  is_correct: boolean | null;
  correct_answer: string;
  explanation?: string | null;
}

export interface QuizSession {
  session_id: string;
  document_id: string;
  status: QuizSessionStatus;
  difficulty: Difficulty;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  score_percentage: number | null;
  questions: SessionQuestionDetail[];
  started_at: string;
  completed_at: string | null;
}

export interface QuizSessionCreateRequest {
  document_id: string;
  num_questions: number;
  difficulty: Difficulty;
  question_types: QuestionType[];
  focus_concept_ids?: string[];
}

export interface Concept {
  id: string;
  concept_name: string;
  concept_description: string | null;
  importance_score: number;
  mastery_score: number;
  is_core: boolean;
}

export interface DocumentConceptsResponse {
  concepts: Concept[];
}

export interface AnswerResult {
  // `null` while a text_free answer is still being graded in the background
  // (eval_status === "pending"). `submitAnswer` polls for the verdict, but
  // the poll window can be exhausted (slow LLM, transient errors) and the
  // response then stays pending — callers MUST handle the null state and
  // never render it as "incorrect".
  is_correct: boolean | null;
  // `null` on pending payloads: the backend never exposes the model answer
  // before the user's answer has been graded.
  correct_answer: string | null;
  explanation?: string | null;
  score_so_far: number;
  total_answered: number;
  feedback?: string | null;
  xp_awarded?: number;
  mastery_delta?: number;
}

export type AnswerEvalStatus = "complete" | "pending";

export interface AnswerResponse {
  result: AnswerResult;
  session_complete: boolean;
  session_ended_reason?: "cap_reached" | "mastery_threshold" | null;
  // "pending" → text_free verdict is still being computed; poll
  // GET /quiz/sessions/{id}/answer for the final result.
  eval_status?: AnswerEvalStatus;
  // Suggested delay before re-polling when a GET /answer long-poll timed out
  // while still pending.
  retry_after_ms?: number | null;
}

export type NextQuestionStatus = "ready" | "preparing" | "ended" | "failed";

export interface NextQuestionSummary {
  total_answered: number;
  correct_answers: number;
  score_percentage: number | null;
}

export interface NextQuestionResponse {
  status: NextQuestionStatus;
  question?: CurrentQuestion | null;
  retry_after_ms?: number | null;
  reason?: "cap_reached" | "mastery_threshold" | null;
  summary?: NextQuestionSummary | null;
  error?: string | null;
  message?: string | null;
}

