# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoCoach is an AI-powered tutoring app that transforms documents (PDFs, PowerPoint) into interactive quizzes using RAG.

**Tech Stack:**
- Frontend: Next.js 16 (App Router), React 19, TypeScript, TailwindCSS 4
- Backend: FastAPI, Python 3.12+
- Databases: Supabase (PostgreSQL + Auth), Qdrant (Vector DB)
- LLMs: Kimi K2.6 (primary, via Moonshot first-party API), OpenAI GPT-4o-mini (fallback)
- Embeddings: OpenAI text-embedding-3-small (1536 dimensions)
- Observability: Langfuse v4 SDK installed, `@observe()` decorators on LLM + retrieval calls. Currently NOOP in prod (`LANGFUSE_*` env vars unset); Langfuse Railway stack deploy pending.

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
2. Kimi K2.6 generates questions (MCQ, True/False, Free Text). `KIMI_MODEL` constant lives at `backend/app/services/llm.py:15` — single-token revert path. `call_kimi` sends `extra_body={"thinking": {"type": "disabled"}}` to suppress reasoning output. `response.model` echo-check warns on silent provider downgrade.
3. Session tracks progress: create → get question → submit answer → evaluate → next question
4. Answer evaluation: MCQ/T-F use direct comparison; Free Text uses LLM semantic evaluation (`call_kimi` → `call_openai` fallback)

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
├── services/      # Business logic (ingestion, chunking, embeddings, quiz_generator, session_manager, answer_evaluator, retrieval, concepts)
├── observability/ # langfuse.py — singleton client, NOOP-when-keys-missing, lifespan flush hook (Phase 1.7)
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

Optional (Langfuse — leave unset for NOOP mode):
```
LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST, LANGFUSE_ENVIRONMENT
```

Frontend needs `NEXT_PUBLIC_BACKEND_URL` for API calls.

## Specs

- `docs/specs/langfuse-selfhost.md` — Phase 1.7 self-hosted Langfuse on Railway (deployment topology, secrets, integration plan, verification, rollback)
- `docs/specs/kimi-k2.6-migration.md` — Kimi K2.5 → K2.6 model bump (recon, breaking-change audit, cost delta, migration plan)
- `docs/HANDOFF.md` — engineering handoff doc; "Phase 1.7 — Where We Are Right Now" section is the canonical session-start read
- `tasks/bugs.md` — pre-existing test failures filed as tickets
