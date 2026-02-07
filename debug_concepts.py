
import asyncio
import os
import sys
from dotenv import load_dotenv

# Load env vars manually
env_path = os.path.join(os.getcwd(), "backend", ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key, value = line.split("=", 1)
                os.environ[key] = value.strip('"').strip("'")

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.supabase import supabase_admin

async def check_recent_documents():
    print("Fetching recent documents...")
    try:
        response = supabase_admin.table("documents").select("*").order("created_at", desc=True).limit(5).execute()
        docs = response.data
        
        if not docs:
            print("No documents found.")
            return

        print(f"Found {len(docs)} recent documents:")
        for doc in docs:
            print(f"\n--- Document: {doc.get('filename')} ({doc.get('id')}) ---")
            print(f"Status: {doc.get('status')}")
            print(f"AI Title: {doc.get('ai_title')}")
            print(f"Created At: {doc.get('created_at')}")
            
            # Check concepts
            concepts_response = supabase_admin.table("concepts").select("*").eq("document_id", doc.get('id')).execute()
            concepts = concepts_response.data
            
            print(f"Concepts Found: {len(concepts)}")
            if concepts:
                print("First 3 concepts:")
                for c in concepts[:3]:
                    print(f"- {c.get('concept_name')} (Score: {c.get('importance_score')})")
            else:
                print("!! NO CONCEPTS FOUND !!")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_recent_documents())
