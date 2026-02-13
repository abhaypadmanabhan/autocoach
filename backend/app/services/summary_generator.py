"""Service for generating document summaries using LLM."""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, List

from pydantic import BaseModel, ConfigDict, ValidationError

from app.core.supabase import supabase_admin
from app.services.llm import call_kimi

logger = logging.getLogger(__name__)


class DocumentSummarySchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    one_liner: str
    what_youll_learn: List[str]
    key_concepts: List[str]
    study_plan: List[str]


def _clean_json_response(response_text: str) -> str:
    """Clean markdown code blocks from JSON response."""
    cleaned = response_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def _clamp_words(text: str, max_words: int = 12) -> str:
    words = (text or "").split()
    return " ".join(words[:max_words]).strip()


def _normalize_concepts_for_hash(
    concepts: List[dict[str, Any]],
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for concept in concepts:
        normalized.append(
            {
                "concept_name": (concept.get("concept_name") or concept.get("name") or "").strip(),
                "concept_description": (
                    concept.get("concept_description") or concept.get("description") or ""
                ).strip(),
                "importance_score": float(concept.get("importance_score") or 0.0),
            }
        )

    normalized.sort(
        key=lambda x: (
            str(x.get("concept_name", "")).lower(),
            str(x.get("concept_description", "")).lower(),
            float(x.get("importance_score", 0.0)),
        )
    )
    return normalized


def compute_concepts_hash(concepts: List[dict[str, Any]]) -> str:
    payload = json.dumps(
        _normalize_concepts_for_hash(concepts),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _validate_and_normalize_summary(payload: dict) -> DocumentSummarySchema:
    required = {"one_liner", "what_youll_learn", "key_concepts", "study_plan"}
    if set(payload.keys()) != required:
        raise ValueError("Summary payload keys do not match required schema")

    summary = DocumentSummarySchema(**payload)
    summary.one_liner = summary.one_liner.strip()
    summary.what_youll_learn = [
        _clamp_words(item, 12) for item in summary.what_youll_learn[:5]
    ]
    summary.key_concepts = [
        item.strip() for item in summary.key_concepts[:6] if item and item.strip()
    ]
    summary.study_plan = [_clamp_words(item, 12) for item in summary.study_plan[:2]]

    if (
        not summary.one_liner
        or not summary.what_youll_learn
        or not summary.key_concepts
        or not summary.study_plan
    ):
        raise ValueError("Summary payload has empty required fields")

    return summary


def _fallback_summary(concepts: List[dict[str, Any]]) -> DocumentSummarySchema:
    concept_names = [
        (concept.get("concept_name") or concept.get("name") or "").strip()
        for concept in concepts
        if (concept.get("concept_name") or concept.get("name") or "").strip()
    ]
    top = concept_names[:6]
    one_liner_topics = ", ".join(top[:3]) if top else "the core topics"

    return DocumentSummarySchema(
        one_liner=f"This document covers {one_liner_topics} and related ideas.",
        what_youll_learn=[
            _clamp_words(f"Understand {name}", 12)
            for name in (top[:5] or ["the document fundamentals"])
        ],
        key_concepts=top or ["Core concepts"],
        study_plan=[
            _clamp_words(
                "Review key concepts before starting targeted practice questions.", 12
            ),
            _clamp_words(
                "Revisit weak areas and repeat quizzes to improve retention.", 12
            ),
        ],
    )


def _build_prompts(
    doc_title: str, concepts: List[dict[str, Any]], strict_json_only: bool
) -> tuple[str, str]:
    concept_list = concepts[:20]
    concepts_text = "\n".join(
        [
            f"- {c.get('concept_name') or c.get('name', '')}: {c.get('concept_description') or c.get('description', '')}"
            for c in concept_list
        ]
    )

    system_prompt = (
        "You are an expert educational content creator."
        " Output strictly valid JSON matching the required schema."
        " Do not output markdown formatting."
    )
    if strict_json_only:
        system_prompt += " Return ONLY valid JSON."

    user_prompt = (
        f"Generate a document summary for '{doc_title}'.\n\n"
        f"Key extracted concepts:\n{concepts_text}\n\n"
        "Return JSON with exactly these keys and no extras:\n"
        "- one_liner\n"
        "- what_youll_learn\n"
        "- key_concepts\n"
        "- study_plan\n\n"
        "Constraints:\n"
        "- one_liner: one concise sentence\n"
        "- what_youll_learn: 3-5 bullets, max 12 words each\n"
        "- key_concepts: 3-6 concept names\n"
        "- study_plan: 1-2 steps, max 12 words each\n"
        "- Reflect only provided concepts\n"
        "- Return only JSON"
    )

    if strict_json_only:
        user_prompt += "\n\nIMPORTANT: return ONLY valid JSON, no prose, no markdown, no code fences."

    return system_prompt, user_prompt


async def generate_document_summary(
    document_id: str, concepts: List[dict[str, Any]], force: bool = False
) -> dict[str, Any]:
    """Generate and persist document summary. Returns summary JSON."""
    try:
        logger.info(f"Starting summary generation for document {document_id}")

        doc = (
            supabase_admin.table("documents")
            .select("summary_json, summary_concepts_hash, ai_title, filename")
            .eq("id", document_id)
            .single()
            .execute()
        )
        if not doc.data:
            raise ValueError(f"Document {document_id} not found")

        raw_doc_data = doc.data
        if not isinstance(raw_doc_data, dict):
            raise ValueError(f"Unexpected document shape for {document_id}")
        doc_data: dict[str, Any] = raw_doc_data

        concepts_hash = compute_concepts_hash(concepts)
        existing_summary = doc_data.get("summary_json")
        existing_hash = doc_data.get("summary_concepts_hash")
        if (
            isinstance(existing_summary, dict)
            and not force
            and existing_hash == concepts_hash
        ):
            logger.info("Summary already up to date; skipping regeneration")
            return existing_summary

        doc_title = doc_data.get("ai_title") or doc_data.get("filename") or "Document"

        summary: DocumentSummarySchema | None = None
        parse_errors: list[str] = []

        for strict_json_only in (False, True):
            system_prompt, user_prompt = _build_prompts(
                doc_title, concepts, strict_json_only
            )
            response_text = call_kimi(system_prompt, user_prompt)
            if not response_text:
                parse_errors.append("empty_response")
                continue

            try:
                parsed = json.loads(_clean_json_response(response_text))
                summary = _validate_and_normalize_summary(parsed)
                break
            except (json.JSONDecodeError, ValidationError, ValueError) as err:
                parse_errors.append(str(err))

        if summary is None:
            logger.warning(
                "Summary generation falling back to deterministic summary. Errors: %s",
                "; ".join(parse_errors),
            )
            summary = _fallback_summary(concepts)

        update_data = {
            "summary_json": summary.model_dump(),
            "summary_generated_at": datetime.now(timezone.utc).isoformat(),
            "summary_version": "v1",
            "summary_concepts_hash": concepts_hash,
        }
        supabase_admin.table("documents").update(update_data).eq(
            "id", document_id
        ).execute()
        logger.info(
            f"Successfully generated and saved summary for document {document_id}"
        )
        return summary.model_dump()

    except Exception as e:
        logger.exception(f"Unexpected error in summary generation: {e}")
        raise
