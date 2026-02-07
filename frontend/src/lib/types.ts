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
export type QuestionType = "mcq" | "true_false" | "free_text";
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
  is_correct: boolean;
  correct_answer: string;
  explanation?: string | null;
  score_so_far: number;
  total_answered: number;
  feedback?: string | null;
}

export interface AnswerResponse {
  result: AnswerResult;
  next_question: CurrentQuestion | null;
  session_complete: boolean;
}

export interface SprintStatusResponse {
  status: "ready" | "completed";
  streak_count: number;
  total_xp: number;
  last_sprint_date: string | null;
  next_sprint_available_at: string | null;
}

export interface StartSprintResponse {
  session_id: string;
  document_id: string;
  document_title: string;
}

export interface CompleteSprintResponse {
  xp_awarded: number;
  new_streak: number;
  new_total_xp: number;
  message: string;
}
