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

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
