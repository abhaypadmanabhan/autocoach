from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, documents, quiz, sessions
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="AutoCoach API",
    description="AI-powered tutoring from your documents",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
app.include_router(sessions.router, prefix="/quiz/sessions", tags=["quiz-sessions"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "AutoCoach API", "docs": "/docs"}
