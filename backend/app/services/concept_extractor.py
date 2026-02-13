"""Service for extracting concepts from documents using LLM."""

import json
import logging
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
    importance_score: float  # 0.0 to 1.0 (will map to importance enum/score in DB)
    prerequisites: List[str]  # List of concept names that are prerequisites


class ExtractionResponse(BaseModel):
    """Schema for the full LLM response."""

    concepts: List[ExtractedConcept]


async def extract_concepts(document_id: str, chunks: List[dict]) -> None:
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
            "You are an expert curriculum designer and teacher. Your goal is to analyze the provided study material "
            "and extract a structured list of key learning concepts. "
            "Focus on the core ideas, theories, or skills a student needs to master. "
            "For each concept, identify its prerequisites from within the same list if applicable. "
            "Output strictly valid JSON matching the specified schema."
        )

        user_prompt = (
            f"Extract 10 to 30 key concepts from the following text. "
            f"For each concept, provide a name, a concise 1-sentence description, "
            f"an importance score (0.0 to 1.0, where 1.0 is critical/core), "
            f"and a list of prerequisite concept names (must be exact names of other extracted concepts).\n\n"
            f"Text:\n{context_text}\n\n"
            f"Response format (JSON):\n"
            f"{{\n"
            f'  "concepts": [\n'
            f'    {{\n'
            f'      "concept_name": "Concept Name",\n'
            f'      "concept_description": "Brief description...",\n'
            f'      "importance_score": 0.9,\n'
            f'      "prerequisites": ["Other Concept Name"]\n'
            f'    }}\n'
            f'  ]\n'
            f"}}"
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

        concepts = extraction.concepts
        logger.info(f"Extracted {len(concepts)} concepts. Saving to database...")

        # Step 1: Insert concepts without parents
        # Map concept_name -> UUID for referencing later
        name_to_id = {}
        
        for concept in concepts:
            # Determine importance enum based on score
            importance_type = "core" if concept.importance_score >= 0.7 else "advanced"
            
            insert_data = {
                "document_id": document_id,
                "concept_name": concept.concept_name,
                "concept_description": concept.concept_description,
                "importance": importance_type,
                "importance_score": concept.importance_score,
                # parent_concept_id left null for now
            }
            
            try:
                res = supabase_admin.table("concepts").insert(insert_data).execute()
                if res.data and len(res.data) > 0:
                    created_id = res.data[0]["id"]
                    name_to_id[concept.concept_name] = created_id
            except Exception as e:
                logger.error(f"Failed to insert concept '{concept.concept_name}': {e}")

        # Step 2: Update parent relationships
        logger.info("Linking prerequisite concepts...")
        for concept in concepts:
            if not concept.prerequisites:
                continue

            current_id = name_to_id.get(concept.concept_name)
            if not current_id:
                continue

            # Find the first valid parent from the prerequisites list (assuming single parent for simple tree, 
            # or we might need to handle many-to-many if schema allowed, but schema has single parent_concept_id)
            # Schema: parent_concept_id (UUID, nullable). Concept model has single parent.
            # If multiple prereqs, we pick the most important or first one found in our map.
            
            parent_id = None
            for prereq_name in concept.prerequisites:
                if prereq_name in name_to_id:
                    parent_id = name_to_id[prereq_name]
                    break  # Take first valid parent
            
            if parent_id:
                try:
                    supabase_admin.table("concepts").update({
                        "parent_concept_id": parent_id
                    }).eq("id", current_id).execute()
                except Exception as e:
                    logger.error(f"Failed to link parent for concept '{concept.concept_name}': {e}")

        logger.info(f"Concept extraction completed for document {document_id}")

        # Step 3: Generate AI Title
        await generate_ai_title(document_id, concepts, chunks)

        # Step 4: Generate Document Summary
        from app.services.summary_generator import generate_document_summary
        # Convert Pydantic models to dicts for the service
        concept_dicts = [c.dict() for c in concepts]
        await generate_document_summary(document_id, concept_dicts)

    except Exception as e:
        logger.exception(f"Unexpected error in concept extraction: {e}")


async def generate_ai_title(document_id: str, concepts: List[ExtractedConcept], chunks: List[dict]) -> None:
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
        # Sort by importance
        sorted_concepts = sorted(concepts, key=lambda c: (c.importance_score), reverse=True)
        core_concepts = [c for c in sorted_concepts if c.importance_score >= 0.7]

        if len(core_concepts) >= 1:
            # Take top 2
            top_concepts = core_concepts[:2]
            title_parts = [c.concept_name for c in top_concepts]
            new_title = " & ".join(title_parts)
            
            # Truncate if too long (simple heuristic)
            if len(new_title) > 40:
                new_title = top_concepts[0].concept_name + " Guide"

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
