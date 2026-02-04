from functools import lru_cache

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

    # Abuse controls
    max_document_mb: int = 20
    max_documents_per_user: int = 2
    max_quiz_sessions_per_day: int = 5
    quiz_requests_per_minute: int = 60

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
