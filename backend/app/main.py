import asyncio
import logging
import re
from contextlib import asynccontextmanager

# Configure logging FIRST, before importing any app modules. The Langfuse
# singleton runs `_init_client()` at module import time and emits the
# "Langfuse disabled: X missing" / "Langfuse client init failed" diagnostics
# via `logger.info` / `logger.exception`. If basicConfig runs after those
# imports, the root logger still has uvicorn's default handlers at WARNING
# threshold and the INFO/exception lines are swallowed — we then see only
# the lifespan banner with no clue why init went NOOP.
# force=True clears handlers uvicorn attached on import so our INFO-level
# config takes effect. Named loggers (uvicorn.access, uvicorn.error) keep
# their own handlers.
logging.basicConfig(level=logging.INFO, force=True)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request, Response  # noqa: E402
from fastapi.exception_handlers import request_validation_exception_handler  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.api.routes import (  # noqa: E402
    health,
    documents,
    sessions,
    review,
    xp,
    onboarding,
)
from app.config import get_settings  # noqa: E402
from app.core.qdrant import keepalive_loop as qdrant_keepalive_loop  # noqa: E402
from app.observability.langfuse import flush as langfuse_flush, is_enabled as langfuse_enabled  # noqa: E402

settings = get_settings()

# Compute allowed origins BEFORE app creation
cors_origins = settings.get_cors_origins()

# Sentry initialization
sentry_enabled = False
if settings.sentry_dsn:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
        )
        sentry_enabled = True
    except Exception as e:
        logger.warning("Sentry client init failed: %s", e)



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - runs on startup and shutdown."""
    # Startup
    logger.info("=" * 50)
    logger.info("AutoCoach API starting up")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"CORS allowed origins: {cors_origins}")
    logger.info(
        f"Langfuse: {'enabled' if langfuse_enabled() else 'disabled (NOOP)'}"
    )
    logger.info(
        f"Sentry: {'enabled' if sentry_enabled else 'disabled (no DSN)'}"
    )
    logger.info("=" * 50)


    keepalive_task = asyncio.create_task(
        qdrant_keepalive_loop(settings.qdrant_keepalive_interval_s)
    )

    yield

    # Shutdown
    keepalive_task.cancel()
    try:
        await keepalive_task
    except asyncio.CancelledError:
        pass
    langfuse_flush()
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
# =============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    expose_headers=["Content-Length"],
    max_age=600,  # Cache preflight for 10 minutes
)


@app.options("/{full_path:path}", include_in_schema=False)
async def options_preflight_passthrough(_full_path: str):
    """Return empty response for non-CORS OPTIONS probes."""
    return Response(status_code=204)


# =============================================================================
# ROUTERS - Added AFTER CORS middleware
# =============================================================================

app.include_router(health.router, tags=["health"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(sessions.router, prefix="/quiz/sessions", tags=["quiz-sessions"])
app.include_router(review.router, prefix="/review", tags=["review"])
app.include_router(xp.router, prefix="/xp", tags=["xp"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "AutoCoach API", "docs": "/docs"}


# Truncate logged bodies to avoid leaking large payloads / PII into Railway
# logs, and redact JWT-like tokens an attacker could plant in fields.
_JWT_RE = re.compile(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+")
_BODY_LOG_LIMIT = 200


def _safe_body_for_log(body) -> str:
    if isinstance(body, bytes):
        body = body.decode("utf-8", errors="replace")
    body = str(body)
    body = _JWT_RE.sub("<jwt_redacted>", body)
    if len(body) > _BODY_LOG_LIMIT:
        body = body[:_BODY_LOG_LIMIT] + "...<truncated>"
    return body


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    if request.method.upper() == "POST" and request.url.path.endswith("/answer"):
        logger.warning(
            "422 validation error on %s %s | body=%s | errors=%s",
            request.method,
            request.url.path,
            _safe_body_for_log(exc.body),
            exc.errors(),
        )

    return await request_validation_exception_handler(request, exc)
