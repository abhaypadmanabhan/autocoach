from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    class Config:
        env_file = ".env"
        extra = "ignore"

    # Supabase
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""

    # Qdrant
    qdrant_url: str
    qdrant_api_key: str
    # Background ping interval to keep the Qdrant Cloud cluster from idling
    # into suspension. 0 disables the keep-alive loop. Default 300s (5 min).
    qdrant_keepalive_interval_s: int = 300

    # AI APIs
    kimi_api_key: str
    openai_api_key: str = ""

    # URLs
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # CORS - comma-separated list of allowed origins
    # Example: "https://autocoach-rho.vercel.app,http://localhost:3000"
    frontend_origins: str = (
        "https://autocoach-rho.vercel.app,http://localhost:3000,http://127.0.0.1:3000"
    )
    cors_allow_credentials: bool = False

    # Environment: "development" or "production"
    environment: str = "development"

    # Abuse controls
    max_document_mb: int = 20
    max_documents_per_user: int = 2
    max_quiz_sessions_per_day: int = 5
    quiz_requests_per_minute: int = 60

    # Adaptive loop / async generation
    # If a question row is stuck in 'generating' status for longer than this,
    # the next /next request marks it 'failed' and re-triggers generation.
    # 30s = ~6x the LLM p95; tune via env without redeploying.
    generation_stale_ttl_seconds: int = 30
    # Long-poll cap on GET /next. Higher than typical p95 LLM, lower than
    # browser request timeouts.
    next_question_max_wait_ms: int = 10000

    # Langfuse / observability
    # See docs/specs/langfuse-selfhost.md §5. All optional — when any of the
    # three credentials below is missing, the observability module enters its
    # NOOP path and `@observe()` decorators become no-ops.
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = ""
    langfuse_environment: str = "development"

    # Sentry
    sentry_dsn: str | None = None


    def get_cors_origins(self) -> List[str]:
        """Build list of allowed CORS origins based on environment."""
        origins: List[str] = [
            "https://autocoach-rho.vercel.app",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

        # Add comma-separated origins from FRONTEND_ORIGINS (primary method)
        if self.frontend_origins:
            for origin in self.frontend_origins.split(","):
                origin = origin.strip()
                # Remove trailing slashes for consistency
                origin = origin.rstrip("/")
                if origin and origin not in origins:
                    origins.append(origin)

        # Add frontend_url if set (backward compat / fallback)
        if self.frontend_url:
            url = self.frontend_url.strip().rstrip("/")
            if url and url not in origins:
                origins.append(url)

        # Safety: ensure we have at least localhost if nothing else is configured
        if not origins:
            origins = ["http://localhost:3000"]

        return origins


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
