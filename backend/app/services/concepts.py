
import logging
from uuid import UUID
from app.core.supabase import supabase_admin
from fastapi import HTTPException

logger = logging.getLogger(__name__)


def get_document_concepts(document_id: str, user_id: str) -> list[dict]:
    """
    Get all concepts for a document with user mastery data.
    
    Args:
        document_id: The document ID.
        user_id: The user ID.
        
    Returns:
        List of concept dictionaries with mastery data.
        
    Raises:
        HTTPException: If Supabase returns an error or unexpected shape.
    """
    logger.info(f"[concepts] Starting fetch: document_id={document_id}, user_id={user_id}")
    
    # Step 1: Fetch concepts by document_id only (no-join fallback baseline)
    logger.info(f"[concepts] Step 1: Fetching concepts from 'concepts' table where document_id={document_id}")
    try:
        concepts_response = (
            supabase_admin.table("concepts")
            .select("*")
            .eq("document_id", document_id)
            .order("importance_score", desc=True)
            .execute()
        )
    except Exception as e:
        logger.error(f"[concepts] Supabase query failed for concepts table: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to query concepts table: {str(e)}"
        )
    
    # Validate response shape
    if not hasattr(concepts_response, 'data'):
        logger.error(f"[concepts] Unexpected response shape from concepts query: {type(concepts_response)}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected response from concepts query: no 'data' attribute"
        )
    
    concepts = concepts_response.data or []
    logger.info(f"[concepts] Step 1 result: Found {len(concepts)} raw concepts in DB for document_id={document_id}")
    
    if not concepts:
        logger.info(f"[concepts] No concepts found for document_id={document_id}, returning empty list")
        return []
    
    # Debug: Log keys in first row to verify column names
    if concepts:
        logger.info(f"[concepts] Keys in first row: {list(concepts[0].keys())}")
    
    concept_ids = [c.get("id") for c in concepts if c.get("id")]
    logger.info(f"[concepts] Concept IDs found: {concept_ids}")
    
    # Step 2: Fetch user mastery for these concepts (join simulation)
    logger.info(f"[concepts] Step 2: Fetching mastery from 'user_concept_mastery' where user_id={user_id} and concept_id in {concept_ids}")
    mastery_map = {}
    
    try:
        mastery_response = (
            supabase_admin.table("user_concept_mastery")
            .select("*")
            .eq("user_id", user_id)
            .in_("concept_id", concept_ids)
            .execute()
        )
        
        # Validate response shape
        if not hasattr(mastery_response, 'data'):
            logger.error(f"[concepts] Unexpected response shape from mastery query: {type(mastery_response)}")
            # Continue with empty mastery - don't fail the whole request
            logger.warning(f"[concepts] Mastery query returned unexpected shape, proceeding with empty mastery")
        else:
            mastery_data = mastery_response.data or []
            logger.info(f"[concepts] Step 2 result: Found {len(mastery_data)} mastery records for user {user_id}")
            mastery_map = {m["concept_id"]: m for m in mastery_data}
            
    except Exception as e:
        # Log but don't fail - we can return concepts without mastery
        logger.warning(f"[concepts] Mastery query failed (proceeding without mastery): {type(e).__name__}: {e}")
        mastery_map = {}
    
    # Step 3: Merge data
    logger.info(f"[concepts] Step 3: Merging {len(concepts)} concepts with {len(mastery_map)} mastery records")
    result = []
    for c in concepts:
        m = mastery_map.get(c.get("id"), {})
        imp_score = c.get("importance_score", 0.0)
        is_core = imp_score >= 0.6
        
        result.append({
            "id": c.get("id"),
            "concept_name": c.get("concept_name", "Unnamed Concept"),
            "concept_description": c.get("concept_description"),
            "importance_score": imp_score,
            "is_core": is_core,
            "parent_concept_id": c.get("parent_concept_id"),
            "created_at": c.get("created_at"),
            "mastery_score": m.get("mastery_score", 0.0) if m else 0.0,
            "times_tested": m.get("times_tested", 0) if m else 0,
            "times_correct": m.get("times_correct", 0) if m else 0,
            "last_tested_at": m.get("last_tested_at") if m else None,
            "mastered_at": m.get("mastered_at") if m else None,
        })
    
    # Sort: Core first, then by importance desc
    result.sort(key=lambda x: (not x["is_core"], -x["importance_score"]))
    
    logger.info(f"[concepts] Final result: Returning {len(result)} merged concepts for document_id={document_id}")
    return result
