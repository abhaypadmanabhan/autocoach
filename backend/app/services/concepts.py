import json
import logging
from collections import Counter
from math import ceil
from typing import List
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from app.core.supabase import supabase_admin
from app.observability.langfuse import observe
from app.services.llm import call_kimi

logger = logging.getLogger(__name__)


class ExtractedConcept(BaseModel):
    """Schema for a concept extracted by the LLM."""

    concept_name: str
    concept_description: str
    importance_score: int  # 1–5 integer scale
    prerequisites: List[str]
    why_important: str = ""


class ExtractionResponse(BaseModel):
    """Schema for the full LLM response."""

    concepts: List[ExtractedConcept]


def _postprocess_concepts(concepts: List[ExtractedConcept]) -> List[dict]:
    """Enforce Pareto-style importance distribution and core/advanced split."""
    if not concepts:
        return []

    items = []
    for c in concepts:
        score = max(1, min(5, c.importance_score))
        items.append({
            "concept_name": c.concept_name,
            "concept_description": c.concept_description,
            "importance_score": score,
            "prerequisites": c.prerequisites,
            "prereq_count": len(c.prerequisites),
        })

    total = len(items)

    if total >= 12:
        histogram = Counter(i["importance_score"] for i in items)

        while histogram.get(1, 0) < 2:
            for target_score in [2, 3, 4, 5]:
                if histogram.get(target_score, 0) > 2:
                    candidates = [i for i in items if i["importance_score"] == target_score]
                    candidates.sort(key=lambda x: x["prereq_count"])
                    candidates[0]["importance_score"] = 1
                    histogram[target_score] -= 1
                    histogram[1] = histogram.get(1, 0) + 1
                    break
            else:
                break

        while histogram.get(5, 0) < 2:
            for target_score in [4, 3, 2, 1]:
                if histogram.get(target_score, 0) > 2:
                    candidates = [i for i in items if i["importance_score"] == target_score]
                    candidates.sort(key=lambda x: -x["prereq_count"])
                    candidates[0]["importance_score"] = 5
                    histogram[target_score] -= 1
                    histogram[5] = histogram.get(5, 0) + 1
                    break
            else:
                break

    items.sort(key=lambda x: (-x["importance_score"], -x["prereq_count"]))

    k = min(8, max(3, ceil(0.2 * total)))
    for i, item in enumerate(items):
        item["importance"] = "core" if i < k else "advanced"

    final_histogram = Counter(i["importance_score"] for i in items)
    core_count = sum(1 for i in items if i["importance"] == "core")
    histogram_str = ",".join(f"{s}:{final_histogram.get(s, 0)}" for s in [5, 4, 3, 2, 1])
    logger.info(f"[concepts] importance histogram: {{{histogram_str}}}, core={core_count}/{total}")

    return items


@observe(name="ingestion.extract_concepts", as_type="generation")
def extract_concepts(document_id: str, chunks: List[dict]) -> None:
    """Extract learning concepts from a document's chunks and store them."""
    try:
        logger.info(f"Starting concept extraction for document {document_id}")

        existing = supabase_admin.table("concepts").select("id").eq("document_id", document_id).limit(1).execute()
        if existing.data and len(existing.data) > 0:
            logger.info(f"Concepts already exist for document {document_id}, skipping extraction.")
            return

        sample_chunks = chunks[:20]
        context_text = "\n\n".join([f"Chunk {i+1}: {c.get('content', '')}" for i, c in enumerate(sample_chunks)])

        system_prompt = (
            "You are an expert curriculum designer. Extract key learning concepts from study material.\n\n"
            "IMPORTANCE SCORING (1–5 integer scale, Pareto distribution):\n"
            "- 5 = Critical foundation (only ~10-15% of concepts). Without this, nothing else makes sense.\n"
            "- 4 = Important building block (~15-20%). Frequently referenced, high connectivity.\n"
            "- 3 = Standard topic (~30-40%). Useful but not foundational.\n"
            "- 2 = Supporting detail (~15-20%). Nice to know, rarely tested alone.\n"
            "- 1 = Peripheral/niche (~10-15%). Trivia, edge cases, rarely needed.\n\n"
            "RULES:\n"
            "- Use the FULL 1–5 range. Do NOT cluster everything at 4-5.\n"
            "- No duplicates. No vague items like 'Introduction' or 'Overview' or 'Summary'.\n"
            "- Prerequisites must be exact names of other concepts in your list.\n"
            "- Output strictly valid JSON matching the specified schema."
        )

        user_prompt = (
            f"Extract 10 to 30 key concepts from the following text.\n"
            f"For each concept provide:\n"
            f"- concept_name: specific, concrete name\n"
            f"- concept_description: 1 sentence\n"
            f"- importance_score: integer 1–5 (use the FULL range, see scoring guide)\n"
            f"- prerequisites: list of concept_name strings from this list\n"
            f"- why_important: 1 sentence explaining why this score\n\n"
            f"Text:\n{context_text}\n\n"
            f"Response format (JSON):\n"
            f'{{\n'
            f'  "concepts": [\n'
            f'    {{\n'
            f'      "concept_name": "Concept Name",\n'
            f'      "concept_description": "Brief description...",\n'
            f'      "importance_score": 3,\n'
            f'      "prerequisites": ["Other Concept Name"],\n'
            f'      "why_important": "Reason for this score..."\n'
            f'    }}\n'
            f'  ]\n'
            f'}}'
        )

        logger.info("Calling Kimi for concept extraction...")
        response_text = call_kimi(system_prompt, user_prompt)

        if not response_text:
            logger.error("Empty response from LLM for concept extraction.")
            return

        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3]

        cleaned_text = cleaned_text.strip()

        try:
            data = json.loads(cleaned_text)
            extraction = ExtractionResponse(**data)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Failed to parse LLM response: {e}\nResponse: {response_text}")
            return

        raw_concepts = extraction.concepts
        logger.info(f"Extracted {len(raw_concepts)} raw concepts. Post-processing...")

        concepts = _postprocess_concepts(raw_concepts)

        logger.info(f"Saving {len(concepts)} concepts to database...")

        name_to_id = {}

        for concept in concepts:
            insert_data = {
                "document_id": document_id,
                "concept_name": concept["concept_name"],
                "concept_description": concept["concept_description"],
                "importance": concept["importance"],
                "importance_score": concept["importance_score"],
            }

            try:
                res = supabase_admin.table("concepts").insert(insert_data).execute()
                if res.data and len(res.data) > 0:
                    created_id = res.data[0]["id"]
                    name_to_id[concept["concept_name"]] = created_id
            except Exception as e:
                logger.error(f"Failed to insert concept '{concept['concept_name']}': {e}")

        logger.info("Linking prerequisite concepts...")
        for concept in concepts:
            if not concept["prerequisites"]:
                continue

            current_id = name_to_id.get(concept["concept_name"])
            if not current_id:
                continue

            parent_id = None
            for prereq_name in concept["prerequisites"]:
                if prereq_name in name_to_id:
                    parent_id = name_to_id[prereq_name]
                    break

            if parent_id:
                try:
                    supabase_admin.table("concepts").update({
                        "parent_concept_id": parent_id
                    }).eq("id", current_id).execute()
                except Exception as e:
                    logger.error(f"Failed to link parent for concept '{concept['concept_name']}': {e}")

        logger.info(f"Concept extraction completed for document {document_id}")

        generate_ai_title(document_id, concepts, chunks)

    except Exception as e:
        logger.exception(f"Unexpected error in concept extraction: {e}")


def generate_ai_title(document_id: str, concepts: List[dict], chunks: List[dict]) -> None:
    """Generate a short, study-friendly title for the document."""
    try:
        doc = supabase_admin.table("documents").select("ai_title").eq("id", document_id).single().execute()
        if doc.data and doc.data.get("ai_title"):
            logger.info("Document already has an AI title, skipping generation.")
            return

        new_title = ""
        core_concepts = [c for c in concepts if c.get("importance") == "core"]

        if len(core_concepts) >= 1:
            top_concepts = core_concepts[:2]
            title_parts = [c["concept_name"] for c in top_concepts]
            new_title = " & ".join(title_parts)

            if len(new_title) > 40:
                new_title = top_concepts[0]["concept_name"] + " Guide"

        if not new_title:
            logger.info("No suitable concepts for title, using LLM fallback...")
            sample_text = "\n".join([c.get("content", "") for c in chunks[:2]])
            sample_text = sample_text[:2000]

            prompt = (
                "Generate a concise, study-friendly title (max 40 characters) for this document. "
                "Do not use quotes or prefixes like 'Title:'. Just the title."
            )

            try:
                ai_response = call_kimi(
                    system_prompt="You are a helpful assistant that generates short document titles.",
                    user_prompt=f"{prompt}\n\nText:\n{sample_text}",
                )
                new_title = ai_response.strip().replace('"', '').replace("Title:", "").strip()
            except Exception as e:
                logger.error(f"LLM title generation failed: {e}")

        if new_title:
            if len(new_title) > 60:
                new_title = new_title[:57] + "..."

            logger.info(f"Setting AI title for document {document_id}: {new_title}")
            supabase_admin.table("documents").update({"ai_title": new_title}).eq("id", document_id).execute()
        else:
            logger.warning("Failed to generate AI title.")

    except Exception as e:
        logger.error(f"Error generating AI title: {e}")


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
    logger.info(
        f"[concepts] Starting fetch: document_id={document_id}, user_id={user_id}"
    )

    # Step 1: Fetch concepts by document_id only (no-join fallback baseline)
    logger.info(
        f"[concepts] Step 1: Fetching concepts from 'concepts' table where document_id={document_id}"
    )
    try:
        concepts_response = (
            supabase_admin.table("concepts")
            .select("*")
            .eq("document_id", document_id)
            .order("importance_score", desc=True)
            .execute()
        )
    except Exception as e:
        logger.error(
            f"[concepts] Supabase query failed for concepts table: {type(e).__name__}: {e}"
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to query concepts table: {str(e)}"
        )

    # Validate response shape
    if not hasattr(concepts_response, "data"):
        logger.error(
            f"[concepts] Unexpected response shape from concepts query: {type(concepts_response)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected response from concepts query: no 'data' attribute",
        )

    concepts = concepts_response.data or []
    logger.info(
        f"[concepts] Step 1 result: Found {len(concepts)} raw concepts in DB for document_id={document_id}"
    )

    if not concepts:
        logger.info(
            f"[concepts] No concepts found for document_id={document_id}, returning empty list"
        )
        return []

    # Debug: Log keys in first row to verify column names
    if concepts:
        logger.info(f"[concepts] Keys in first row: {list(concepts[0].keys())}")

    concept_ids = [c.get("id") for c in concepts if c.get("id")]
    logger.info(f"[concepts] Concept IDs found: {concept_ids}")

    # Step 2: Fetch user mastery for these concepts (join simulation)
    logger.info(
        f"[concepts] Step 2: Fetching mastery from 'user_concept_mastery' where user_id={user_id} and concept_id in {concept_ids}"
    )
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
        if not hasattr(mastery_response, "data"):
            logger.error(
                f"[concepts] Unexpected response shape from mastery query: {type(mastery_response)}"
            )
            # Continue with empty mastery - don't fail the whole request
            logger.warning(
                f"[concepts] Mastery query returned unexpected shape, proceeding with empty mastery"
            )
        else:
            mastery_data = mastery_response.data or []
            logger.info(
                f"[concepts] Step 2 result: Found {len(mastery_data)} mastery records for user {user_id}"
            )
            mastery_map = {m["concept_id"]: m for m in mastery_data}

    except Exception as e:
        # Log but don't fail - we can return concepts without mastery
        logger.warning(
            f"[concepts] Mastery query failed (proceeding without mastery): {type(e).__name__}: {e}"
        )
        mastery_map = {}

    # Step 3: Merge data
    logger.info(
        f"[concepts] Step 3: Merging {len(concepts)} concepts with {len(mastery_map)} mastery records"
    )
    result = []
    for c in concepts:
        m = mastery_map.get(c.get("id"), {})
        imp_score = c.get("importance_score", 0.0)
        is_core = c.get("importance") == "core"

        result.append(
            {
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
            }
        )

    # Sort: Core first, then by importance desc
    result.sort(key=lambda x: (not x["is_core"], -x["importance_score"]))

    logger.info(
        f"[concepts] Final result: Returning {len(result)} merged concepts for document_id={document_id}"
    )
    return result


def get_due_concepts(user_id: str, limit: int = 20) -> list[dict]:
    """
    Get concepts due for review.
    Criteria:
    1. Mastery score < 75.0 (weak)
    2. OR Last tested > 2 days ago (stale)

    Ordered by:
    1. Mastery score ASC (weakest first)
    2. Last tested ASC (oldest first)

    Args:
        user_id: The user ID.
        limit: Max number of concepts to return.

    Returns:
        List of concept dictionaries with mastery data.
    """
    # Safety cap: API contract for review/today is max 20
    limit = max(1, min(limit, 20))
    logger.info(
        f"[concepts] Fetching due concepts for user_id={user_id}, limit={limit}"
    )

    try:
        from datetime import datetime, timedelta, timezone

        # Calculate stale threshold (2 days ago)
        stale_threshold = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

        # We support schemas that might use either last_practiced_at or last_tested_at.
        # Try last_practiced_at first, then gracefully fallback.
        practice_columns = ["last_practiced_at", "last_tested_at"]
        mastery_response = None
        selected_practice_col = "last_tested_at"

        for practice_col in practice_columns:
            or_filter = f"mastery_score.lt.75,and({practice_col}.lt.{stale_threshold},times_tested.gt.0)"
            try:
                mastery_response = (
                    supabase_admin.table("user_concept_mastery")
                    .select("*")
                    .eq("user_id", user_id)
                    .or_(or_filter)
                    .order("mastery_score", desc=False)
                    .order(practice_col, desc=False)
                    .limit(limit)
                    .execute()
                )
                selected_practice_col = practice_col
                break
            except Exception as col_err:
                logger.warning(
                    "[concepts] Due concept query failed using %s for user %s: %s",
                    practice_col,
                    user_id,
                    col_err,
                )

        # Final fallback: return weak concepts only if both practice columns are unavailable
        if mastery_response is None:
            logger.warning(
                "[concepts] Falling back to mastery-only due concept query for user %s",
                user_id,
            )
            mastery_response = (
                supabase_admin.table("user_concept_mastery")
                .select("*")
                .eq("user_id", user_id)
                .lt("mastery_score", 75)
                .order("mastery_score", desc=False)
                .limit(limit)
                .execute()
            )

        if not mastery_response.data:
            logger.info("[concepts] No due concepts found for user")
            # If OR filter is tricky, we can try a broader fetch and filter in memory if the dataset isn't huge?
            # Or make two queries?
            # The .or_ syntax above is standard PostgREST.
            return []

        mastery_data = mastery_response.data
        concept_ids = [m["concept_id"] for m in mastery_data]

        if not concept_ids:
            return []

        # Step 2: Fetch concept details
        concepts_response = (
            supabase_admin.table("concepts")
            .select("id, concept_name, document_id")
            .in_("id", concept_ids)
            .execute()
        )

        if not concepts_response.data:
            logger.warning("[concepts] Mastery records exist but concepts not found")
            return []

        concepts_map = {c["id"]: c for c in concepts_response.data}

        # Step 3: Merge and format
        result = []
        for m in mastery_data:
            c = concepts_map.get(m["concept_id"])
            if c:
                score = float(m.get("mastery_score", 0))
                result.append(
                    {
                        "id": c["id"],
                        "name": c["concept_name"],
                        "document_id": c["document_id"],
                        "mastery_score": score,
                        "mastery_percent": int(score * 100)
                        if score <= 1.0
                        else int(score),  # Handle potential scale mix safely
                        "last_tested_at": m.get(selected_practice_col)
                        or m.get("last_tested_at"),
                    }
                )

        # Primary: low mastery first. Secondary: oldest practiced first when available.
        # Null practice timestamps should come last.
        result.sort(
            key=lambda x: (
                x["mastery_score"],
                x["last_tested_at"] is None,
                x["last_tested_at"] or "9999-12-31T23:59:59+00:00",
            )
        )

        return result[:limit]

    except Exception as e:
        logger.error(f"[concepts] Failed to fetch due concepts: {e}")
        return []
