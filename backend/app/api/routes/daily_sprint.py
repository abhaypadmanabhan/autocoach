import logging
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

from app.api.routes.documents import get_user_id_from_token
from app.core.supabase import supabase_admin
from app.models.sprint import (
    SprintStatusResponse,
    StartSprintResponse,
    CompleteSprintRequest,
    CompleteSprintResponse,
)
from app.services.quiz_generator import generate_quiz_questions
from app.models.quiz import QuestionSchema

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=SprintStatusResponse)
async def get_sprint_status(user_id: UUID = Depends(get_user_id_from_token)):
    """
    Get the current user's Daily Sprint status.
    Creates the user record if it doesn't exist.
    """
    try:
        # Fetch user profile
        response = supabase_admin.table("users").select("*").eq("id", str(user_id)).execute()
        
        user_data = None
        if not response.data:
            # Create user profile if missing
            logger.info(f"Creating user profile for {user_id}")
            new_user = {
                "id": str(user_id),
                "streak_count": 0,
                "total_xp": 0,
                # Email/Name would ideally be synced from Auth hook, but we leave them null/optional here
            }
            insert_res = supabase_admin.table("users").insert(new_user).execute()
            if insert_res.data:
                user_data = insert_res.data[0]
        else:
            user_data = response.data[0]
            
        if not user_data:
            raise HTTPException(status_code=500, detail="Failed to retrieve user profile")
            
        last_date = user_data.get("last_sprint_date")
        streak = user_data.get("streak_count", 0)
        xp = user_data.get("total_xp", 0)
        
        # Check if done today (UTC)
        is_done_today = False
        if last_date:
            last_date_obj = datetime.fromisoformat(last_date).date() if isinstance(last_date, str) else last_date
            today = datetime.utcnow().date()
            if last_date_obj == today:
                is_done_today = True
        
        status = "completed" if is_done_today else "ready"
        
        return SprintStatusResponse(
            status=status,
            streak_count=streak,
            total_xp=xp,
            last_sprint_date=datetime.fromisoformat(last_date).date() if last_date else None,
            next_sprint_available_at=None # valid logic could be added here
        )
        
    except Exception as e:
        logger.error(f"Error fetching sprint status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start", response_model=StartSprintResponse)
async def start_sprint(user_id: UUID = Depends(get_user_id_from_token)):
    """
    Start a Daily Sprint session.
    Selects the best document (most weak concepts) and generates questions.
    """
    try:
        # 1. Identify Target Document (Weakest Concepts)
        # We need to query user_concept_mastery joined with concepts?
        # Supabase-py join syntax is tricky. easier to fetch mastery < 80 and aggregate in python
        
        # Fetch mastery items below 80%
        mastery_res = (
            supabase_admin.table("user_concept_mastery")
            .select("concept_id, mastery_score, concept:concepts(document_id)")
            .eq("user_id", str(user_id))
            .lt("mastery_score", 80)
            .execute()
        )
        
        target_document_id = None
        target_concept_ids = []
        
        if mastery_res.data:
            # Group by document_id
            doc_counts = {}
            doc_concepts = {}
            
            for item in mastery_res.data:
                # item['concept'] might be null if concept deleted but mastery remains (depend on cascade)
                if not item.get("concept"):
                    continue
                    
                # Supabase returns single object for foreign key if 1:1 or N:1, but concepts is N:1 to document?
                # No, mastery -> concept (N:1). concept -> document (N:1).
                # So concept:concepts(document_id) should return { document_id: ... }
                
                doc_id = item["concept"]["document_id"]
                concept_id = item["concept_id"]
                
                doc_counts[doc_id] = doc_counts.get(doc_id, 0) + 1
                if doc_id not in doc_concepts:
                    doc_concepts[doc_id] = []
                doc_concepts[doc_id].append(concept_id)
            
            # Pick max
            if doc_counts:
                target_document_id = max(doc_counts, key=doc_counts.get)
                # Pick top 5 concepts from this doc
                target_concept_ids = doc_concepts[target_document_id][:5]
        
        # Fallback: If no weak concepts, pick most recent document
        if not target_document_id:
            docs_res = (
                supabase_admin.table("documents")
                .select("id")
                .eq("user_id", str(user_id))
                .eq("status", "ready")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if docs_res.data:
                target_document_id = docs_res.data[0]["id"]
            else:
                raise HTTPException(status_code=400, detail="No documents available to sprint on. Please upload a document first.")
                
        # 2. Get Document Title (for UI)
        doc_res = supabase_admin.table("documents").select("filename, ai_title").eq("id", target_document_id).single().execute()
        doc_title = doc_res.data.get("ai_title") or doc_res.data.get("filename")
        
        # 3. Generate Questions (5 qs)
        questions_data = generate_quiz_questions(
            document_id=target_document_id,
            num_questions=5,
            difficulty="medium", # Default for sprint
            question_types=["mcq", "true_false"], # fast input
            target_concepts=None # TODO: Pass concept IDs to generator if supported
            # For now, generator might pick random. Enhancing generator is a separate task.
        )
        
        if not questions_data:
             raise HTTPException(status_code=500, detail="Failed to generate questions")

        # 4. Create Quiz Session
        session_data = {
            "user_id": str(user_id),
            "document_id": target_document_id,
            "difficulty": "medium",
            "status": "active",
            "total_questions": len(questions_data),
            # We add a metadata tag to identify this as a daily sprint
            # But QuizSession doesn't have metadata field?
            # We'll rely on client context or add a field later. 
            # ideally we should add 'type' column to quiz_sessions but avoiding schema change for now if possible.
            # actually we can't distinguish unless we store it.
            # But the client knows it called /daily-sprint/start, so it treats it as sprint.
            # Only issue is resuming. For v1, no resuming if abandoned.
        }
        
        sess_res = supabase_admin.table("quiz_sessions").insert(session_data).execute()
        if not sess_res.data:
            raise HTTPException(status_code=500, detail="Failed to create session")
            
        session_id = sess_res.data[0]["id"]
        
        # 5. Insert Questions
        questions_to_insert = []
        for i, q in enumerate(questions_data):
            questions_to_insert.append({
                "session_id": session_id,
                "question_text": q.get("question_text"),
                "question_type": q.get("question_type", "mcq"),
                "options": q.get("options"),
                "correct_answer": q.get("correct_answer"),
                "explanation": q.get("explanation"),
                "question_number": i + 1
            })
            
        q_res = supabase_admin.table("questions").insert(questions_to_insert).execute()
        
        return StartSprintResponse(
            session_id=session_id,
            document_id=target_document_id,
            document_title=doc_title
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting sprint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complete", response_model=CompleteSprintResponse)
async def complete_sprint(
    request: CompleteSprintRequest,
    user_id: UUID = Depends(get_user_id_from_token)
):
    """
    Complete a sprint, award XP, and update streak.
    """
    try:
        # Verify user exists
        user_res = supabase_admin.table("users").select("*").eq("id", str(user_id)).single().execute()
        if not user_res.data:
            raise HTTPException(status_code=404, detail="User not found")
            
        user_data = user_res.data
        current_xp = user_data.get("total_xp", 0)
        current_streak = user_data.get("streak_count", 0)
        last_date = user_data.get("last_sprint_date")

        # verify session belongs to user? (optional for v1 speed)
        
        # Calculate Rewards
        # Base: 100 XP
        # Bonus: 10 XP per correct answer
        xp_gain = 100 + (request.correct_count * 10)
        
        # Streak Logic
        now = datetime.utcnow()
        today = now.date()
        
        new_streak = current_streak
        
        is_already_done_today = False
        if last_date:
            last_date_obj = datetime.fromisoformat(last_date).date() if isinstance(last_date, str) else last_date
            if last_date_obj == today:
                is_already_done_today = True
            elif (today - last_date_obj).days == 1:
                # Consecutive day
                new_streak += 1
            elif (today - last_date_obj).days > 1:
                # Broken streak
                new_streak = 1
        else:
            # First ever
            new_streak = 1
            
        # If already done today, maybe don't award streak?
        # Spec says "Works even if only 1 document exists" and "Sprint already completed today".
        # If repeated, maybe less XP? For v1, full XP but NO streak increment if already done.
        
        if is_already_done_today:
            new_streak = current_streak # No change
        
        # Update User
        update_data = {
            "total_xp": current_xp + xp_gain,
            "streak_count": new_streak,
            "last_sprint_date": now.isoformat()
        }
        
        supabase_admin.table("users").update(update_data).eq("id", str(user_id)).execute()
        
        message = "Sprint Complete!"
        if not is_already_done_today:
             message = f"Streak Extended! {new_streak} Days!"
             
        return CompleteSprintResponse(
            xp_awarded=xp_gain,
            new_streak=new_streak,
            new_total_xp=current_xp + xp_gain,
            message=message
        )

    except Exception as e:
        logger.error(f"Error completing sprint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
