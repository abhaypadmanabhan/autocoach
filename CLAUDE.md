# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoCoach is an AI-powered tutoring app that transforms documents (PDFs, PowerPoint) into interactive quizzes using RAG.

**Tech Stack:**
- Frontend: Next.js 16 (App Router), React 19, TypeScript, TailwindCSS 4
- Backend: FastAPI, Python 3.12+
- Databases: Supabase (PostgreSQL + Auth), Qdrant (Vector DB)
- LLMs: Kimi K2.5 (primary), OpenAI GPT-4o-mini (fallback)
- Embeddings: OpenAI text-embedding-3-small (1536 dimensions)

## Commands

### Frontend (`/frontend`)
```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

### Backend (`/backend`)
```bash
source venv/bin/activate
uvicorn app.main:app --reload  # Dev server at localhost:8000, docs at /docs
```

## Architecture

### Document Processing Pipeline
```
Upload → Supabase Storage → Text Extraction (PDF/PPTX) → Chunking → OpenAI Embeddings → Qdrant
```
Document status: `pending` → `processing` → `ready` (or `failed`)

### Quiz Flow
1. RAG retrieves relevant chunks from Qdrant by `document_id`
2. Kimi K2.5 generates questions (MCQ, True/False, Free Text)
3. Session tracks progress: create → get question → submit answer → evaluate → next question
4. Answer evaluation: MCQ/T-F use direct comparison; Free Text uses LLM semantic evaluation

### Auth Pattern
- Supabase Auth with JWT tokens
- Frontend middleware protects routes (`/frontend/src/middleware.ts`)
- Backend validates tokens via Supabase client
- `apiClient` in `/frontend/src/lib/api.ts` adds Bearer token to requests

## Key Directories

```
frontend/src/
├── app/           # Next.js App Router pages (dashboard, upload, session, results)
├── hooks/         # useQuiz.ts, useDocuments.ts - API hooks with loading/error states
└── lib/           # api.ts (API client), supabase/ (client, server, middleware)

backend/app/
├── api/routes/    # FastAPI endpoints (documents, quiz, sessions, health)
├── services/      # Business logic (ingestion, chunking, embeddings, quiz_generator, session_manager, answer_evaluator)
├── core/          # supabase.py (admin + public clients), qdrant.py
└── models/        # Pydantic models (quiz.py, documents.py)
```

## Key API Endpoints

- `POST /documents/upload` - Upload and process document
- `GET /documents` - List user documents
- `POST /documents/{id}/search` - RAG search within document
- `POST /quiz/sessions/` - Create session with first question
- `GET /quiz/sessions/{id}/current` - Get current unanswered question
- `POST /quiz/sessions/{id}/answer?question_id=...` - Submit answer, get next/results

## Database Tables (Supabase)

- `documents`: user_id, filename, file_type, status, chunk_count
- `chunks`: document_id, content, chunk_index, embedding_id
- `quiz_sessions`: user_id, document_id, status, total_questions, correct_answers
- `questions`: session_id, question_type, question_text, options, correct_answer, user_answer, is_correct

## Environment Variables

Required in `.env`:
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
QDRANT_URL, QDRANT_API_KEY
KIMI_API_KEY, OPENAI_API_KEY
```

Frontend needs `NEXT_PUBLIC_BACKEND_URL` for API calls.
