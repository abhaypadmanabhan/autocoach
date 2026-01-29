"""Document ingestion pipeline service."""

import logging
from uuid import UUID

from app.core.supabase import supabase_admin
from app.core.qdrant import store_vectors
from app.services.text_extraction import extract_text_from_pdf, extract_text_from_pptx
from app.services.chunking import chunk_text
from app.services.embeddings import get_embeddings

logger = logging.getLogger(__name__)


async def process_document(document_id: str) -> None:
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
            logger.info(f"Downloaded file {file_path}, size: {len(file_bytes)} bytes")
        except Exception as e:
            logger.error(f"Failed to download file {file_path}: {e}")
            _mark_document_failed(document_id, f"Failed to download file: {str(e)}")
            return

        # Extract text based on file type
        try:
            if file_type == "pdf":
                full_text, page_count = extract_text_from_pdf(file_bytes)
            elif file_type == "pptx":
                full_text, page_count = extract_text_from_pptx(file_bytes)
            else:
                logger.error(f"Unsupported file type: {file_type}")
                _mark_document_failed(document_id, f"Unsupported file type: {file_type}")
                return
        except Exception as e:
            logger.error(f"Failed to extract text from document {document_id}: {e}")
            _mark_document_failed(document_id, f"Text extraction failed: {str(e)}")
            return

        # Check if extraction was successful
        if not full_text or not full_text.strip():
            logger.error(f"No text extracted from document {document_id}")
            _mark_document_failed(document_id, "No text could be extracted from the document")
            return

        logger.info(f"Extracted {len(full_text)} characters, {page_count} pages/slides")

        # Chunk the text
        try:
            chunks = chunk_text(full_text)
            if not chunks:
                logger.error(f"No chunks created from document {document_id}")
                _mark_document_failed(document_id, "Failed to create text chunks")
                return
            logger.info(f"Created {len(chunks)} chunks")
        except Exception as e:
            logger.error(f"Failed to chunk text for document {document_id}: {e}")
            _mark_document_failed(document_id, f"Text chunking failed: {str(e)}")
            return

        # Generate embeddings
        try:
            texts = [chunk["content"] for chunk in chunks]
            embeddings = get_embeddings(texts)
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
            point_ids = store_vectors(document_id, chunks, embeddings)
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
