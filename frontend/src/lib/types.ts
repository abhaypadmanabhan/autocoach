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

// Quiz types
export type QuestionType = "mcq" | "true_false" | "free_text";
export type Difficulty = "easy" | "medium" | "hard";
export type QuizSessionStatus = "active" | "completed";
export type InputMethod = "typed" | "voice";

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
