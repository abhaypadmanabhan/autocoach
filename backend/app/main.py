from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, documents, quiz, sessions, voice
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="AutoCoach API",
    description="AI-powered tutoring from your documents",
    version="0.1.0",
)

# CORS middleware - hardened for production
# Origins are configured via FRONTEND_ORIGINS env var (comma-separated)
cors_origins = settings.get_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
    expose_headers=["X-Request-ID"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
app.include_router(sessions.router, prefix="/quiz/sessions", tags=["quiz-sessions"])
app.include_router(voice.router, prefix="/voice", tags=["voice"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "AutoCoach API", "docs": "/docs"}
