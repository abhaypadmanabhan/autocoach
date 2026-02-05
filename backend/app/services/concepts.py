
import logging
from uuid import UUID
from app.core.supabase import supabase_admin

logger = logging.getLogger(__name__)

def get_document_concepts(document_id: str, user_id: str) -> list[dict]:
    """
    Get all concepts for a document with user mastery data.
    
    Args:
        document_id: The document ID.
        user_id: The user ID.
        
    Returns:
        List of concept dictionaries with mastery data.
    """
    try:
        # 1. Fetch all concepts for this document
        concepts_response = (
            supabase_admin.table("concepts")
            .select("*")
            .eq("document_id", document_id)
            .order("importance_score", desc=True)
            .execute()
        )
        
        concepts = concepts_response.data or []
        if not concepts:
            return []
            
        concept_ids = [c["id"] for c in concepts]
        
        # 2. Fetch user mastery for these concepts
        # Note: 'in' filter requires tuple or list
        if not concept_ids:
            return []
            
        mastery_response = (
            supabase_admin.table("user_concept_mastery")
            .select("*")
            .eq("user_id", user_id)
            .in_("concept_id", concept_ids)
            .execute()
        )
        
        mastery_map = {m["concept_id"]: m for m in (mastery_response.data or [])}
        
        # 3. Merge data
        result = []
        for c in concepts:
            m = mastery_map.get(c["id"], {})
            imp_score = c.get("importance_score", 0.0)
            is_core = imp_score >= 0.6
            
            result.append({
                "id": c["id"],
                "concept_name": c["name"],
                "concept_description": c.get("description"),
                "importance_score": imp_score,
                "is_core": is_core,
                "parent_concept_id": c.get("parent_concept_id"),
                "created_at": c["created_at"],
                "mastery_score": m.get("mastery_score", 0.0),
                "times_tested": m.get("times_tested", 0),
                "times_correct": m.get("times_correct", 0),
                "last_tested_at": m.get("last_tested_at"),
                "mastered_at": m.get("mastered_at"),
            })
            
        # Sort: Core first, then by importance desc
        result.sort(key=lambda x: (not x["is_core"], -x["importance_score"]))
            
        return result
        
    except Exception as e:
        logger.error(f"Failed to fetch document concepts: {e}")
        return []
