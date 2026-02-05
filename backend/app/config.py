from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str

    # Qdrant
    qdrant_url: str
    qdrant_api_key: str

    # AI APIs
    kimi_api_key: str
    openai_api_key: str = ""

    # URLs
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # CORS - comma-separated list of allowed origins for production
    # Example: "https://myapp.vercel.app,https://myapp-git-main.vercel.app"
    frontend_origins: str = ""

    # Environment: "development" or "production"
    environment: str = "development"

    # Abuse controls
    max_document_mb: int = 20
    max_documents_per_user: int = 2
    max_quiz_sessions_per_day: int = 5
    quiz_requests_per_minute: int = 60

    class Config:
        env_file = ".env"
        extra = "ignore"

    def get_cors_origins(self) -> List[str]:
        """Build list of allowed CORS origins based on environment."""
        origins: List[str] = []

        # In development (or if not explicitly production), allow localhost
        if self.environment != "production":
            origins.extend([
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ])

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
