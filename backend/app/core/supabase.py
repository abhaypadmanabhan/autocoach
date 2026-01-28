from supabase import create_client, Client

from app.config import get_settings

settings = get_settings()

# Admin client: Uses the secret key, bypasses RLS (Row Level Security)
# Use this for backend operations that need full database access
# e.g., creating users, admin operations, background jobs
supabase_admin: Client = create_client(
    settings.supabase_url,
    settings.supabase_secret_key
)

# Public client: Uses the publishable (anon) key, respects RLS policies
# Use this when you want to respect the database's Row Level Security
# e.g., operations on behalf of authenticated users, respecting their permissions
supabase_public: Client = create_client(
    settings.supabase_url,
    settings.supabase_publishable_key
)
