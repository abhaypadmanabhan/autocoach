import logging
import os
from supabase import create_client, Client

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

SUPABASE_VERSION = "unknown"
try:
    import supabase

    SUPABASE_VERSION = getattr(supabase, "__version__", "unknown")
except Exception:
    pass


def _get_supabase_url() -> str:
    """Get Supabase URL from env, with fallback to settings."""
    return os.environ.get("SUPABASE_URL") or settings.supabase_url


def _get_supabase_secret_key() -> str:
    """Get Supabase secret key from env, with fallback to settings."""
    return os.environ.get("SUPABASE_SECRET_KEY") or settings.supabase_secret_key


def _get_supabase_publishable_key() -> str:
    """Get Supabase publishable key from env, with fallback to settings."""
    return (
        os.environ.get("SUPABASE_PUBLISHABLE_KEY") or settings.supabase_publishable_key
    )


def _mask_value(value: str) -> str:
    """Mask a value for safe logging: show length + last 6 chars."""
    if not value:
        return "MISSING"
    if len(value) <= 6:
        return f"present(len={len(value)})"
    return f"present(len={len(value)}, tail={value[-6:]})"


supabase_url = _get_supabase_url()
supabase_secret_key = _get_supabase_secret_key()
supabase_publishable_key = _get_supabase_publishable_key()

logger.info("=" * 50)
logger.info("Supabase Client Configuration")
logger.info(f"supabase package version: {SUPABASE_VERSION}")
logger.info(f"supabase_url: {_mask_value(supabase_url)}")
logger.info(f"supabase_secret_key: {_mask_value(supabase_secret_key)}")
logger.info(f"supabase_publishable_key: {_mask_value(supabase_publishable_key)}")
logger.info("=" * 50)

# Admin client: Uses the secret key, bypasses RLS (Row Level Security)
# Use this for backend operations that need full database access
# e.g., creating users, admin operations, background jobs
supabase_admin: Client = create_client(supabase_url, supabase_secret_key)

# Public client: Uses the publishable (anon) key, respects RLS policies
# Use this when you want to respect the database's Row Level Security
# e.g., operations on behalf of authenticated users, respecting their permissions
supabase_public: Client = create_client(supabase_url, supabase_publishable_key)
