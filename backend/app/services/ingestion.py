"""Document ingestion pipeline service."""

import json
import logging
from uuid import UUID

from app.config import get_settings
from app.core.supabase import supabase_admin
from app.core.qdrant import store_vectors
from app.observability.langfuse import observe
from app.services.text_extraction import extract_pdf_pages, extract_pptx_slides
from app.services.chunking import chunk_units
from app.services.embeddings import get_embeddings

logger = logging.getLogger(__name__)

# Hard caps to prevent file-bomb / extracted-text-bomb DoS and runaway LLM
# spend. Client-supplied file_size in /documents/register is untrusted —
# enforce the real byte count after download.
_settings = get_settings()
MAX_DOCUMENT_BYTES = _settings.max_document_mb * 1024 * 1024
MAX_EXTRACTED_CHARS = 2_000_000
MAX_CHUNKS = 2500


@observe(
    name="ingestion.extract",
    as_type="span",
    capture_input=False,
    capture_output=False,
)
def _extract_document_text(file_type: str, file_bytes: bytes) -> tuple[list[dict], int]:
    """Per-page (PDF) or per-slide (PPTX) text units, plus the page/slide count."""
    if file_type == "pdf":
        return extract_pdf_pages(file_bytes)
    if file_type == "pptx":
        return extract_pptx_slides(file_bytes)
    raise ValueError(f"Unsupported file type: {file_type}")


def _cap_units(units: list[dict], max_chars: int) -> list[dict]:
    """Keep units in order until max_chars total; cut the unit that crosses it."""
    kept = []
    remaining = max_chars
    for unit in units:
        if remaining <= 0:
            break
        text = unit["text"][:remaining]
        kept.append({**unit, "text": text})
        remaining -= len(text)
    return kept


@observe(
    name="ingestion.chunk",
    as_type="span",
    capture_input=False,
    capture_output=False,
)
def _chunk_document_text(units: list[dict]) -> list[dict]:
    return chunk_units(units)


@observe(
    name="ingestion.embed",
    as_type="span",
    capture_input=False,
    capture_output=False,
)
def _embed_chunks(chunks: list[dict]) -> list[list[float]]:
    texts = [chunk["content"] for chunk in chunks]
    return get_embeddings(texts)


@observe(
    name="ingestion.upsert",
    as_type="span",
    capture_input=False,
    capture_output=False,
)
def _upsert_vectors(
    document_id: str,
    chunks: list[dict],
    embeddings: list[list[float]],
) -> list[str]:
    return store_vectors(document_id, chunks, embeddings)


@observe(name="ingestion.process_document", as_type="span", capture_output=False)
def process_document(document_id: str) -> None:
    """
    Process a document through the full ingestion pipeline.

    This function:
    1. Updates document status to 'processing'
    2. Downloads the file from Supabase Storage
    3. Extracts text based on file type
    4. Chunks the text
    5. Generates embeddings
    6. Stores vectors in Qdrant
    7. Saves chunks to database
    8. Updates document status to 'ready' or 'failed'

    Args:
        document_id: The UUID of the document to process.
    """
    try:
        # Update status to 'processing'
        logger.info(f"Starting processing for document {document_id}")
        supabase_admin.table("documents").update({
            "status": "processing"
        }).eq("id", document_id).execute()

        # Fetch document record
        doc_response = supabase_admin.table("documents").select("*").eq("id", document_id).execute()
        
        if not doc_response.data or len(doc_response.data) == 0:
            logger.error(f"Document {document_id} not found")
            return
        
        document = doc_response.data[0]
        file_path = document["file_path"]
        file_type = document["file_type"]
        
        logger.info(f"Processing document {document_id} of type {file_type}")

        # Download file from Supabase Storage
        try:
            file_response = supabase_admin.storage.from_("documents").download(file_path)
            file_bytes = file_response
            actual_size = len(file_bytes)
            logger.info(f"Downloaded file {file_path}, size: {actual_size} bytes")
        except Exception as e:
            logger.error(f"Failed to download file {file_path}: {e}")
            _mark_document_failed(document_id, f"Failed to download file: {str(e)}")
            return

        if actual_size > MAX_DOCUMENT_BYTES:
            logger.warning(
                f"Document {document_id} oversize: {actual_size} > {MAX_DOCUMENT_BYTES} bytes"
            )
            _mark_document_failed(
                document_id,
                f"File exceeds {_settings.max_document_mb}MB limit",
            )
            return

        # Extract text based on file type
        try:
            if file_type not in ("pdf", "pptx"):
                logger.error(f"Unsupported file type: {file_type}")
                _mark_document_failed(document_id, f"Unsupported file type: {file_type}")
                return
            units, page_count = _extract_document_text(file_type, file_bytes)
        except Exception as e:
            logger.error(f"Failed to extract text from document {document_id}: {e}")
            _mark_document_failed(document_id, f"Text extraction failed: {str(e)}")
            return

        # Check if extraction was successful
        if not units:
            logger.error(f"No text extracted from document {document_id}")
            _mark_document_failed(document_id, "No text could be extracted from the document")
            return

        extracted_chars = sum(len(unit["text"]) for unit in units)
        logger.info(f"Extracted {extracted_chars} characters, {page_count} pages/slides")

        # Cap extracted text across units — guards against PDF/PPTX bombs whose
        # decompressed text expands to GBs from a small input.
        if extracted_chars > MAX_EXTRACTED_CHARS:
            units = _cap_units(units, MAX_EXTRACTED_CHARS)

        # Chunk the text
        try:
            chunks = _chunk_document_text(units)
            if not chunks:
                logger.error(f"No chunks created from document {document_id}")
                _mark_document_failed(document_id, "Failed to create text chunks")
                return
            chunk_total = len(chunks)
            if chunk_total > MAX_CHUNKS:
                chunks = chunks[:MAX_CHUNKS]
            if extracted_chars > MAX_EXTRACTED_CHARS or chunk_total > MAX_CHUNKS:
                _log_truncation(
                    document_id,
                    extracted_chars=extracted_chars,
                    chunk_total=chunk_total,
                    last_unit=chunks[-1]["metadata"],
                )
            logger.info(f"Created {len(chunks)} chunks")
        except Exception as e:
            logger.error(f"Failed to chunk text for document {document_id}: {e}")
            _mark_document_failed(document_id, f"Text chunking failed: {str(e)}")
            return

        # Generate embeddings
        try:
            embeddings = _embed_chunks(chunks)
            if not embeddings:
                logger.error(f"No embeddings generated for document {document_id}")
                _mark_document_failed(document_id, "Failed to generate embeddings")
                return
            logger.info(f"Generated {len(embeddings)} embeddings")
        except Exception as e:
            logger.error(f"Failed to generate embeddings for document {document_id}: {e}")
            _mark_document_failed(document_id, f"Embedding generation failed: {str(e)}")
            return

        # Store vectors in Qdrant
        try:
            point_ids = _upsert_vectors(document_id, chunks, embeddings)
            logger.info(f"Stored {len(point_ids)} vectors in Qdrant")
        except Exception as e:
            logger.error(f"Failed to store vectors for document {document_id}: {e}")
            _mark_document_failed(document_id, f"Vector storage failed: {str(e)}")
            return

        # Save chunks to database
        try:
            chunk_records = []
            for i, chunk in enumerate(chunks):
                chunk_record = {
                    "document_id": document_id,
                    "content": chunk["content"],
                    "chunk_index": chunk["chunk_index"],
                    "embedding_id": point_ids[i] if i < len(point_ids) else None,
                    "metadata": chunk.get("metadata", {})
                }
                chunk_records.append(chunk_record)
            
            # Insert chunks in batches to avoid request size limits
            batch_size = 100
            for i in range(0, len(chunk_records), batch_size):
                batch = chunk_records[i:i + batch_size]
                supabase_admin.table("chunks").insert(batch).execute()
            
            logger.info(f"Saved {len(chunk_records)} chunks to database")
        except Exception as e:
            logger.error(f"Failed to save chunks for document {document_id}: {e}")
            _mark_document_failed(document_id, f"Failed to save chunks: {str(e)}")
            return

        # Extract concepts from chunks (Non-blocking: failure here should not fail the document)
        try:
             from app.services.concepts import extract_concepts
             extract_concepts(document_id, chunks)
        except Exception as e:
             logger.error(f"Concept extraction failed for document {document_id}: {e}")
             # Do NOT mark document as failed, just log the error.

        # Auto-create quiz session (Non-blocking)
        try:
            from app.services.session_manager import create_session
            from datetime import datetime, timezone
            
            user_id = document["user_id"]
            now = datetime.now(timezone.utc)
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            
            # Check for existing session today
            existing_session = supabase_admin.table("quiz_sessions") \
                .select("id") \
                .eq("document_id", document_id) \
                .gte("created_at", start_of_day) \
                .limit(1) \
                .execute()
                
            if not existing_session.data:
                logger.info(f"Auto-creating quiz session for document {document_id}")
                create_session(
                    user_id=user_id,
                    document_id=document_id,
                    num_questions=5,
                    difficulty="medium",
                    question_types=["text_mcq", "text_tf", "text_free"],
                )
            else:
                logger.info(f"Quiz session already exists for document {document_id} today, skipping auto-creation.")
        except Exception as e:
             logger.error(f"Auto quiz session creation failed for document {document_id}: {e}")

        # Update document status to 'ready'
        try:
            supabase_admin.table("documents").update({
                "status": "ready",
                "chunk_count": len(chunks),
                "page_count": page_count
            }).eq("id", document_id).execute()
            logger.info(f"Document {document_id} processed successfully")
        except Exception as e:
            logger.error(f"Failed to update document status for {document_id}: {e}")
            # Don't mark as failed here since processing was successful

    except Exception as e:
        logger.error(f"Unexpected error processing document {document_id}: {e}")
        _mark_document_failed(document_id, f"Unexpected error: {str(e)}")


def _log_truncation(
    document_id: str,
    *,
    extracted_chars: int,
    chunk_total: int,
    last_unit: dict,
) -> None:
    """
    Record that a ready document was only partly ingested.

    A structured warning rather than documents.error_message: both web screens
    render error_message only for failed documents and iOS never reads it, so
    a ready document's note there would be seen by nobody and would read as an
    error to any future consumer.
    """
    logger.warning(
        "ingestion.truncated %s",
        json.dumps({
            "document_id": document_id,
            "extracted_chars": extracted_chars,
            "max_extracted_chars": MAX_EXTRACTED_CHARS,
            "chunks_total": chunk_total,
            "chunks_kept": min(chunk_total, MAX_CHUNKS),
            "max_chunks": MAX_CHUNKS,
            "last_kept_unit": last_unit,
        }),
    )


def _mark_document_failed(document_id: str, error_message: str) -> None:
    """
    Mark a document as failed with an error message.

    Args:
        document_id: The ID of the document to mark as failed.
        error_message: The error message to store.
    """
    try:
        supabase_admin.table("documents").update({
            "status": "failed",
            "error_message": error_message
        }).eq("id", document_id).execute()
        logger.info(f"Marked document {document_id} as failed: {error_message}")
    except Exception as e:
        logger.error(f"Failed to mark document {document_id} as failed: {e}")
