"""Service for extracting concepts from documents using LLM."""

import json
import logging
from collections import Counter
from math import ceil
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ValidationError

from app.core.supabase import supabase_admin
from app.services.llm import call_kimi

logger = logging.getLogger(__name__)


class ExtractedConcept(BaseModel):
    """Schema for a concept extracted by the LLM."""

    concept_name: str
    concept_description: str
    importance_score: int  # 1–5 integer scale
    prerequisites: List[str]  # List of concept names that are prerequisites
    why_important: str = ""  # 1-sentence justification


class ExtractionResponse(BaseModel):
    """Schema for the full LLM response."""

    concepts: List[ExtractedConcept]


def _postprocess_concepts(concepts: List[ExtractedConcept]) -> List[dict]:
    """
    Deterministic post-processing to enforce Pareto-style distribution.

    1. Clamp importance_score to [1, 5]
    2. Enforce histogram spread (when >= 12 concepts)
    3. Sort by importance desc, tie-break by prerequisite count
    4. Assign core/advanced: top K = core, rest = advanced
    5. Log histogram and core count

    Returns list of dicts ready for DB insert.
    """
    if not concepts:
        return []

    # Build working list with clamped scores
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

    # Enforce histogram spread when we have enough concepts
    if total >= 12:
        histogram = Counter(i["importance_score"] for i in items)

        # Ensure at least 2 at score=1: demote lowest-scored items
        while histogram.get(1, 0) < 2:
            # Find a concept at the lowest non-1 score to demote
            for target_score in [2, 3, 4, 5]:
                if histogram.get(target_score, 0) > 2:
                    # Demote the one with fewest prerequisites (least connected)
                    candidates = [i for i in items if i["importance_score"] == target_score]
                    candidates.sort(key=lambda x: x["prereq_count"])
                    candidates[0]["importance_score"] = 1
                    histogram[target_score] -= 1
                    histogram[1] = histogram.get(1, 0) + 1
                    break
            else:
                break  # Can't redistribute further

        # Ensure at least 2 at score=5: promote highest-scored items
        while histogram.get(5, 0) < 2:
            for target_score in [4, 3, 2, 1]:
                if histogram.get(target_score, 0) > 2:
                    # Promote the one with most prerequisites (most connected)
                    candidates = [i for i in items if i["importance_score"] == target_score]
                    candidates.sort(key=lambda x: -x["prereq_count"])
                    candidates[0]["importance_score"] = 5
                    histogram[target_score] -= 1
                    histogram[5] = histogram.get(5, 0) + 1
                    break
            else:
                break

    # Sort by importance desc, tie-break by prereq count desc (more connected = higher)
    items.sort(key=lambda x: (-x["importance_score"], -x["prereq_count"]))

    # Compute core: top K concepts
    k = min(8, max(3, ceil(0.2 * total)))
    for i, item in enumerate(items):
        item["importance"] = "core" if i < k else "advanced"

    # Log histogram and core count
    final_histogram = Counter(i["importance_score"] for i in items)
    core_count = sum(1 for i in items if i["importance"] == "core")
    histogram_str = ",".join(f"{s}:{final_histogram.get(s, 0)}" for s in [5, 4, 3, 2, 1])
    logger.info(f"[concepts] importance histogram: {{{histogram_str}}}, core={core_count}/{total}")

    return items


def extract_concepts(document_id: str, chunks: List[dict]) -> None:
    """
    Extract learning concepts from a document's chunks and store them.

    Args:
        document_id: The UUID of the document.
        chunks: List of chunk dictionaries (must contain 'content').
    """
    try:
        logger.info(f"Starting concept extraction for document {document_id}")

        # Check for existing concepts to ensure idempotency
        existing = supabase_admin.table("concepts").select("id").eq("document_id", document_id).limit(1).execute()
        if existing.data and len(existing.data) > 0:
            logger.info(f"Concepts already exist for document {document_id}, skipping extraction.")
            return

        # Prepare context from first 20 chunks (approx representative sample)
        # We limit text to avoid huge prompts, as Kimi has a large context but we want speed/efficiency.
        sample_chunks = chunks[:20]
        context_text = "\n\n".join([f"Chunk {i+1}: {c.get('content', '')}" for i, c in enumerate(sample_chunks)])

        # Construct Prompt
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

        # Call Kimi
        logger.info("Calling Kimi for concept extraction...")
        response_text = call_kimi(system_prompt, user_prompt)

        if not response_text:
            logger.error("Empty response from LLM for concept extraction.")
            return

        # Clean code blocks if present
        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3]
        
        cleaned_text = cleaned_text.strip()

        # Parse and Validate
        try:
            data = json.loads(cleaned_text)
            extraction = ExtractionResponse(**data)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Failed to parse LLM response: {e}\nResponse: {response_text}")
            return

        raw_concepts = extraction.concepts
        logger.info(f"Extracted {len(raw_concepts)} raw concepts. Post-processing...")

        # Post-process: enforce Pareto distribution and assign core/advanced
        concepts = _postprocess_concepts(raw_concepts)

        logger.info(f"Saving {len(concepts)} concepts to database...")

        # Step 1: Insert concepts without parents
        # Map concept_name -> UUID for referencing later
        name_to_id = {}

        for concept in concepts:
            insert_data = {
                "document_id": document_id,
                "concept_name": concept["concept_name"],
                "concept_description": concept["concept_description"],
                "importance": concept["importance"],
                "importance_score": concept["importance_score"],
                # parent_concept_id left null for now
            }

            try:
                res = supabase_admin.table("concepts").insert(insert_data).execute()
                if res.data and len(res.data) > 0:
                    created_id = res.data[0]["id"]
                    name_to_id[concept["concept_name"]] = created_id
            except Exception as e:
                logger.error(f"Failed to insert concept '{concept['concept_name']}': {e}")

        # Step 2: Update parent relationships
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
                    break  # Take first valid parent

            if parent_id:
                try:
                    supabase_admin.table("concepts").update({
                        "parent_concept_id": parent_id
                    }).eq("id", current_id).execute()
                except Exception as e:
                    logger.error(f"Failed to link parent for concept '{concept['concept_name']}': {e}")

        logger.info(f"Concept extraction completed for document {document_id}")

        # Step 3: Generate AI Title
        generate_ai_title(document_id, concepts, chunks)

        # Step 4: Generate Document Summary
        from app.services.summary_generator import generate_document_summary
        generate_document_summary(document_id, concepts)

    except Exception as e:
        logger.exception(f"Unexpected error in concept extraction: {e}")


def generate_ai_title(document_id: str, concepts: List[dict], chunks: List[dict]) -> None:
    """
    Generate a short, study-friendly title for the document.
    
    Strategy:
    1. Check if title already exists (idempotency).
    2. detailed concepts: "Concept A & Concept B" (Top 2 core).
    3. Fallback LLM: "Generate title from text".
    """
    try:
        # 1. Idempotency check
        doc = supabase_admin.table("documents").select("ai_title").eq("id", document_id).single().execute()
        if doc.data and doc.data.get("ai_title"):
            logger.info("Document already has an AI title, skipping generation.")
            return

        new_title = ""

        # 2. Strategy A: Use Core Concepts
        # Concepts are already sorted by importance desc from _postprocess_concepts
        core_concepts = [c for c in concepts if c.get("importance") == "core"]

        if len(core_concepts) >= 1:
            # Take top 2
            top_concepts = core_concepts[:2]
            title_parts = [c["concept_name"] for c in top_concepts]
            new_title = " & ".join(title_parts)

            # Truncate if too long (simple heuristic)
            if len(new_title) > 40:
                new_title = top_concepts[0]["concept_name"] + " Guide"

        # 3. Strategy B: LLM Fallback
        if not new_title:
             logger.info("No suitable concepts for title, using LLM fallback...")
             # Use first 2 chunks or ~2000 chars
             sample_text = "\n".join([c.get("content", "") for c in chunks[:2]])
             sample_text = sample_text[:2000]

             prompt = (
                 "Generate a concise, study-friendly title (max 40 characters) for this document. "
                 "Do not use quotes or prefixes like 'Title:'. Just the title."
             )
             
             try:
                 ai_response = call_kimi(
                     system_prompt="You are a helpful assistant that generates short document titles.",
                     user_prompt=f"{prompt}\n\nText:\n{sample_text}"
                 )
                 new_title = ai_response.strip().replace('"', '').replace("Title:", "").strip()
             except Exception as e:
                 logger.error(f"LLM title generation failed: {e}")

        # 4. Save if we have a title
        if new_title:
            # Enforce hard limit
            if len(new_title) > 60:
                new_title = new_title[:57] + "..."
            
            logger.info(f"Setting AI title for document {document_id}: {new_title}")
            supabase_admin.table("documents").update({"ai_title": new_title}).eq("id", document_id).execute()
        else:
            logger.warning("Failed to generate AI title.")

    except Exception as e:
        logger.error(f"Error generating AI title: {e}")
