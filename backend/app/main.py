import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    health,
    documents,
    quiz,
    sessions,
    voice,
    daily_sprint,
    sprints,
    concepts,
    review,
    xp,
    onboarding,
)
from app.config import get_settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

# Compute allowed origins BEFORE app creation
cors_origins = settings.get_cors_origins()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - runs on startup and shutdown."""
    # Startup
    logger.info("=" * 50)
    logger.info("AutoCoach API starting up")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"CORS allowed origins: {cors_origins}")
    logger.info("=" * 50)
    yield
    # Shutdown
    logger.info("AutoCoach API shutting down")


app = FastAPI(
    title="AutoCoach API",
    description="AI-powered tutoring from your documents",
    version="0.1.0",
    lifespan=lifespan,
)

# =============================================================================
# CORS MIDDLEWARE - MUST BE ADDED FIRST, BEFORE ANY ROUTERS
# =============================================================================
# This ensures OPTIONS preflight requests are handled before any auth
# dependencies can intercept and return 400/401 errors.
#
# Using allow_headers=["*"] and allow_methods=["*"] ensures browsers
# can send any header (including Authorization) and any method.
# =============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods including OPTIONS
    allow_headers=["*"],  # Allows all headers including Authorization
    expose_headers=["*"],
    max_age=600,  # Cache preflight for 10 minutes
)

# =============================================================================
# ROUTERS - Added AFTER CORS middleware
# =============================================================================

app.include_router(health.router, tags=["health"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
app.include_router(sessions.router, prefix="/quiz/sessions", tags=["quiz-sessions"])
app.include_router(voice.router, prefix="/voice", tags=["voice"])
app.include_router(daily_sprint.router, prefix="/daily-sprint", tags=["daily-sprint"])
app.include_router(sprints.router, prefix="/sprint", tags=["sprint"])
app.include_router(concepts.router, prefix="/concepts", tags=["concepts"])
app.include_router(review.router, prefix="/review", tags=["review"])
app.include_router(xp.router, prefix="/xp", tags=["xp"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])



@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "AutoCoach API", "docs": "/docs"}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    if request.method.upper() == "POST" and request.url.path.endswith("/answer"):
        body = exc.body
        if isinstance(body, bytes):
            body = body.decode("utf-8", errors="replace")

        logger.warning(
            "422 validation error on %s %s | body=%s | errors=%s",
            request.method,
            request.url.path,
            body,
            exc.errors(),
        )

    return await request_validation_exception_handler(request, exc)
