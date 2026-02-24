import asyncio
import uuid
import sys
import os

# Ensure the backend directory is in the python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.supabase import supabase_admin

async def test_onboarding():
    user_id = str(uuid.uuid4())
    print(f"Testing with user_id={user_id}")
    
    # Case A: no row exists -> GET returns has_completed=false
    # Note: we are simulating the DB call logic from get_onboarding
    res = (
        supabase_admin.table("user_onboarding")
        .select("learning_topics,goal,study_frequency")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    row = rows[0] if rows else None
    print(f"Case A - GET (empty): {row}")
    assert row is None, "Row should be None initially"
    
    # Case B: POST creates -> GET returns has_completed=true
    payload = {
        "user_id": user_id,
        "learning_topics": ["math", "science"],
        "goal": "Learn things",
        "study_frequency": "daily"
    }
    
    upsert_res = (
        supabase_admin.table("user_onboarding")
        .upsert(payload, on_conflict="user_id")
        .execute()
    )
    print(f"Case B - POST result: {upsert_res.data}")
    
    # GET after POST
    res = (
        supabase_admin.table("user_onboarding")
        .select("learning_topics,goal,study_frequency")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    row = rows[0] if rows else None
    print(f"Case B - GET (after): {row}")
    assert row["goal"] == "Learn things", "Goal should match upsert payload"
    
    # Cleanup
    supabase_admin.table("user_onboarding").delete().eq("user_id", user_id).execute()
    print("Cleanup successful, tests passed!")

if __name__ == "__main__":
    asyncio.run(test_onboarding())
