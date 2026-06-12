from uuid import UUID, uuid4
import math

from fastapi import (
    APIRouter,
    Request,
    UploadFile,
    File,
    HTTPException,
    Depends,
    Header,
    BackgroundTasks,
    Response,
)

import logging

from app.config import get_settings
from app.core.supabase import supabase_admin
from app.core.qdrant import delete_document_vectors
from app.models.documents import (
    DocumentResponse,
    DocumentListResponse,
    RegisterDocumentRequest,
    SearchRequest,
    SearchResponse,
    ChunkResult,
    DocumentConceptsResponse,
    ConceptSchema,
    DocumentProgressResponse,
    DocumentProgressSummaryResponse,
)
from app.services.abuse_controls import enforce_max_documents
from app.services.ingestion import process_document
from app.services.retrieval import retrieve_relevant_chunks
from app.services.concepts import get_document_concepts

router = APIRouter()

settings = get_settings()

# Constants for file validation
ALLOWED_EXTENSIONS = {".pdf", ".pptx"}
ALLOWED_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
MAX_FILE_SIZE_MB = settings.max_document_mb
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def get_file_extension(filename: str) -> str:
    """Get the file extension from a filename."""
    return filename[filename.rfind(".") :].lower() if "." in filename else ""


async def get_user_id_from_token(authorization: str = Header(...)) -> UUID:
    """
    Extract and verify Bearer token from authorization header.

    Args:
        authorization: The Authorization header value.

    Returns:
        The user's UUID.

    Raises:
        HTTPException: 401 if token is invalid or missing.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header. Expected 'Bearer <token>'",
        )

    token = authorization.replace("Bearer ", "")

    try:
        user_response = supabase_admin.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return UUID(user_response.user.id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=401, detail="Token validation failed"
        )


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_user_id_from_token),
):
    """
    Upload a document to the server.

    Args:
        file: The file to upload (PDF or PPTX).
        user_id: The authenticated user's ID (from token).

    Returns:
        DocumentResponse with the uploaded document's details.

    Raises:
        HTTPException: 400 if file type or size is invalid.
        HTTPException: 500 if upload fails.
    """
    # Validate file extension
    file_ext = get_file_extension(file.filename or "")
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Only {', '.join(ALLOWED_EXTENSIONS)} files are allowed.",
        )

    expected_content_type = ALLOWED_CONTENT_TYPES[file_ext]
    if file.content_type != expected_content_type:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid content type. Expected {expected_content_type}.",
        )

    # Enforce document quota before reading file
    enforce_max_documents(user_id, settings.max_documents_per_user)

    # Reject oversized uploads early using Content-Length header (before reading body)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413, detail=f"File size exceeds {MAX_FILE_SIZE_MB}MB limit."
        )

    # Read file bytes
    file_bytes = await file.read()
    file_size = len(file_bytes)

    # Validate actual file size (second defence, catches missing Content-Length)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413, detail=f"File size exceeds {MAX_FILE_SIZE_MB}MB limit."
        )

    # Determine file type
    file_type = "pdf" if file_ext == ".pdf" else "pptx"

    # Generate unique file path
    document_id = uuid4()
    file_path = f"{user_id}/{document_id}/{file.filename}"

    try:
        # Upload to Supabase Storage
        storage_response = supabase_admin.storage.from_("documents").upload(
            path=file_path,
            file=file_bytes,
            file_options={
                "content-type": file.content_type or "application/octet-stream"
            },
        )

        if hasattr(storage_response, "error") and storage_response.error:
            logger.error("Supabase storage upload failed: %s", storage_response.error)
            raise HTTPException(status_code=500, detail="Upload failed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Supabase storage upload raised: %s", e)
        raise HTTPException(status_code=500, detail="Upload failed")

    try:
        # Insert record into documents table
        document_data = {
            "id": str(document_id),
            "user_id": str(user_id),
            "filename": file.filename,
            "file_path": file_path,
            "file_type": file_type,
            "file_size": file_size,
            "status": "pending",
        }

        db_response = supabase_admin.table("documents").insert(document_data).execute()

        if not db_response.data:
            raise HTTPException(
                status_code=500, detail="Failed to create document record in database"
            )

        created_document = db_response.data[0]

        # Trigger async document processing
        background_tasks.add_task(process_document, str(document_id))

        return DocumentResponse(
            id=UUID(created_document["id"]),
            filename=created_document["filename"],
            file_type=created_document["file_type"],
            file_size=created_document["file_size"],
            status=created_document["status"],
            created_at=created_document["created_at"],
            ai_title=created_document.get("ai_title"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Failed to create document record"
        )


@router.post("/register", response_model=DocumentResponse)
async def register_document(
    request: RegisterDocumentRequest,
    background_tasks: BackgroundTasks,
    user_id: UUID = Depends(get_user_id_from_token),
):
    """
    Register a document that was uploaded directly to Supabase Storage.

    This endpoint is used when the frontend uploads files directly to storage
    (bypassing the backend), then registers the document for processing.

    Args:
        request: The registration request with file details.
        background_tasks: FastAPI background tasks for async processing.
        user_id: The authenticated user's ID (from token).

    Returns:
        DocumentResponse with the registered document's details.

    Raises:
        HTTPException: 400 if file path is invalid or file doesn't exist.
        HTTPException: 403 if file path doesn't belong to user.
        HTTPException: 500 if registration fails.
    """
    # Validate file extension
    file_ext = get_file_extension(request.filename)
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Only {', '.join(ALLOWED_EXTENSIONS)} files are allowed.",
        )

    if ".." in request.file_path.split("/"):
        raise HTTPException(status_code=400, detail="Invalid file path.")

    # Validate file path ownership - must start with user's ID
    if not request.file_path.startswith(f"{user_id}/"):
        raise HTTPException(
            status_code=403,
            detail="File path does not belong to authenticated user.",
        )

    # Validate file type matches extension
    expected_type = "pdf" if file_ext == ".pdf" else "pptx"
    if request.file_type != expected_type:
        raise HTTPException(
            status_code=400,
            detail=f"File type mismatch. Expected '{expected_type}' for {file_ext} file.",
        )

    # Validate file size
    if request.file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File size exceeds {MAX_FILE_SIZE_MB}MB limit.",
        )

    # Enforce document quota
    enforce_max_documents(user_id, settings.max_documents_per_user)

    # Verify file exists in storage
    try:
        # Try to get file metadata by listing the path
        storage_list = supabase_admin.storage.from_("documents").list(
            path="/".join(request.file_path.split("/")[:-1])  # Get parent folder
        )
        filename = request.file_path.split("/")[-1]
        file_exists = any(f.get("name") == filename for f in storage_list)

        if not file_exists:
            raise HTTPException(
                status_code=400,
                detail="File not found in storage. Please upload the file first.",
            )
    except HTTPException:
        raise
    except Exception as e:
        # If we can't verify, proceed anyway - ingestion will fail if file doesn't exist
        pass

    # Generate document ID
    document_id = uuid4()

    try:
        # Insert record into documents table
        document_data = {
            "id": str(document_id),
            "user_id": str(user_id),
            "filename": request.filename,
            "file_path": request.file_path,
            "file_type": request.file_type,
            "file_size": request.file_size,
            "status": "pending",
        }

        db_response = supabase_admin.table("documents").insert(document_data).execute()

        if not db_response.data:
            raise HTTPException(
                status_code=500, detail="Failed to create document record in database"
            )

        created_document = db_response.data[0]

        # Trigger async document processing
        background_tasks.add_task(process_document, str(document_id))

        return DocumentResponse(
            id=UUID(created_document["id"]),
            filename=created_document["filename"],
            file_type=created_document["file_type"],
            file_size=created_document["file_size"],
            status=created_document["status"],
            created_at=created_document["created_at"],
            ai_title=created_document.get("ai_title"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Failed to register document"
        )


@router.get("/", response_model=DocumentListResponse)
async def list_documents(user_id: UUID = Depends(get_user_id_from_token)):
    """
    List all documents for the authenticated user.

    Args:
        user_id: The authenticated user's ID (from token).

    Returns:
        DocumentListResponse with a list of documents.

    Raises:
        HTTPException: 500 if query fails.
    """
    try:
        response = (
            supabase_admin.table("documents")
            .select("*")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .execute()
        )

        if not response.data:
            return DocumentListResponse(documents=[])

        # Fetch all session IDs for these documents
        doc_ids = [str(doc["id"]) for doc in response.data]
        sessions_map = {}
        if doc_ids:
            sessions_response = (
                supabase_admin.table("quiz_sessions")
                .select("id, document_id, created_at")
                .in_("document_id", doc_ids)
                .order("created_at", desc=True)
                .execute()
            )
            for session in (sessions_response.data or []):
                doc_id = session["document_id"]
                if doc_id not in sessions_map:
                    sessions_map[doc_id] = session["id"]

        documents = [
            DocumentResponse(
                id=UUID(doc["id"]),
                filename=doc["filename"],
                file_type=doc["file_type"],
                file_size=doc["file_size"],
                status=doc["status"],
                created_at=doc["created_at"],
                ai_title=doc.get("ai_title"),
                session_id=sessions_map.get(str(doc["id"])),
            )
            for doc in response.data
        ]

        return DocumentListResponse(documents=documents)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Failed to fetch documents"
        )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID, user_id: UUID = Depends(get_user_id_from_token)
):
    """
    Get a specific document by ID.

    Args:
        document_id: The ID of the document to retrieve.
        user_id: The authenticated user's ID (from token).

    Returns:
        DocumentResponse with the document's details.

    Raises:
        HTTPException: 404 if document not found or doesn't belong to user.
        HTTPException: 500 if query fails.
    """
    try:
        response = (
            supabase_admin.table("documents")
            .select("*")
            .eq("id", str(document_id))
            .eq("user_id", str(user_id))
            .execute()
        )

        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Document not found")

        doc = response.data[0]

        # Fetch latest session ID for this document
        session_id = None
        session_response = (
            supabase_admin.table("quiz_sessions")
            .select("id")
            .eq("document_id", str(document_id))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if session_response.data:
            session_id = session_response.data[0]["id"]

        # Count concepts for this document
        concept_count = None
        try:
            concepts_count_response = (
                supabase_admin.table("concepts")
                .select("id", count="exact")
                .eq("document_id", str(document_id))
                .execute()
            )
            concept_count = concepts_count_response.count
        except Exception:
            pass

        return DocumentResponse(
            id=UUID(doc["id"]),
            filename=doc["filename"],
            file_type=doc["file_type"],
            file_size=doc["file_size"],
            status=doc["status"],
            created_at=doc["created_at"],
            ai_title=doc.get("ai_title"),
            session_id=session_id,
            concept_count=concept_count,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Failed to fetch document"
        )


@router.get("/{document_id}/concepts", response_model=DocumentConceptsResponse)
async def get_document_concepts_endpoint(
    document_id: UUID, user_id: UUID = Depends(get_user_id_from_token)
):
    """
    Get concepts for a document with user mastery data.

    Args:
        document_id: The ID of the document.
        user_id: The authenticated user's ID.

    Returns:
        DocumentConceptsResponse with list of concepts.

    Raises:
        HTTPException: 404 if document not found.
        HTTPException: 500 if query fails.
    """
    logger.info(
        f"[documents/concepts] Route called: document_id={document_id}, resolved user_id={user_id}"
    )

    try:
        # Verify document existence/ownership (light check)
        logger.info(
            f"[documents/concepts] Verifying document ownership: document_id={document_id}, user_id={user_id}"
        )
        doc_response = (
            supabase_admin.table("documents")
            .select("id")
            .eq("id", str(document_id))
            .eq("user_id", str(user_id))
            .execute()
        )

        if not doc_response.data:
            logger.warning(
                f"[documents/concepts] Document {document_id} not found for user {user_id}"
            )
            raise HTTPException(status_code=404, detail="Document not found")

        logger.info(
            f"[documents/concepts] Document verified, calling service: document_id={document_id}, user_id={user_id}"
        )
        concepts = get_document_concepts(str(document_id), str(user_id))
        logger.info(
            f"[documents/concepts] Service returned {len(concepts)} concepts for document {document_id}"
        )
        logger.info(
            f"[documents/concepts] First concept keys={list(concepts[0].keys()) if concepts else 'EMPTY'}"
        )

        return DocumentConceptsResponse(
            document_id=document_id, concepts=[ConceptSchema(**c) for c in concepts]
        )
    except HTTPException:
        # Re-raise HTTP exceptions (404, 500 from service, etc.)
        raise
    except Exception as e:
        logger.error(f"[documents/concepts] Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get document concepts"
        )


@router.post("/{document_id}/search", response_model=SearchResponse)
async def search_document(
    document_id: UUID,
    search_request: SearchRequest,
    user_id: UUID = Depends(get_user_id_from_token),
):
    """
    Search for relevant chunks within a document.

    Args:
        document_id: The ID of the document to search within.
        search_request: The search request containing query and top_k.
        user_id: The authenticated user's ID (from token).

    Returns:
        SearchResponse with the query and relevant chunks.

    Raises:
        HTTPException: 404 if document not found or doesn't belong to user.
        HTTPException: 400 if document is not ready for search.
        HTTPException: 500 if search fails.
    """
    try:
        # Verify document exists and belongs to user
        response = (
            supabase_admin.table("documents")
            .select("*")
            .eq("id", str(document_id))
            .eq("user_id", str(user_id))
            .execute()
        )

        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Document not found")

        doc = response.data[0]

        # Check if document is ready for search
        if doc["status"] != "ready":
            raise HTTPException(
                status_code=400,
                detail=f"Document is not ready for search. Current status: {doc['status']}",
            )

        # Retrieve relevant chunks
        results = retrieve_relevant_chunks(
            query=search_request.query,
            document_id=str(document_id),
            top_k=search_request.top_k,
        )

        # Convert to ChunkResult models
        chunk_results = [
            ChunkResult(
                content=result["content"],
                chunk_index=result["chunk_index"],
                score=result["score"],
            )
            for result in results
        ]

        return SearchResponse(
            query=search_request.query,
            document_id=str(document_id),
            results=chunk_results,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Failed to search document"
        )


logger = logging.getLogger(__name__)


def _normalize_mastery_percent(value: object) -> float:
    """Normalize mastery value to 0..100 float and guard invalid values."""
    try:
        score = float(value if value is not None else 0.0)
    except (TypeError, ValueError):
        return 0.0

    if not math.isfinite(score):
        return 0.0

    # Backward compatibility: accept either ratio (0..1) or percent (0..100)
    if 0.0 <= score <= 1.0:
        score *= 100.0

    return min(100.0, max(0.0, score))


def _milestone_from_percent(mastery_percent: int) -> str:
    if mastery_percent >= 100:
        return "100"
    if mastery_percent >= 75:
        return "75"
    if mastery_percent >= 50:
        return "50"
    if mastery_percent >= 25:
        return "25"
    return "none"


def _calculate_progress(concepts: list[dict]) -> tuple[int, int, int, int, int, str]:
    total_concepts = len(concepts)
    practiced_concepts = sum(
        1 for c in concepts if int(c.get("times_tested", 0) or 0) > 0
    )
    normalized_scores = [
        _normalize_mastery_percent(c.get("mastery_score", 0)) for c in concepts
    ]

    # Weak concepts should be concepts the user has practiced and is still weak at.
    weak_concepts = sum(
        1
        for c, score in zip(concepts, normalized_scores)
        if int(c.get("times_tested", 0) or 0) > 0 and score < 60.0
    )
    mastered_concepts = sum(1 for score in normalized_scores if score >= 85.0)

    mastery_percent = 0
    if total_concepts > 0:
        mastery_percent = int(sum(normalized_scores) / total_concepts)

    milestone = _milestone_from_percent(mastery_percent)
    return (
        total_concepts,
        practiced_concepts,
        weak_concepts,
        mastered_concepts,
        mastery_percent,
        milestone,
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    user_id: UUID = Depends(get_user_id_from_token),
):
    """
    Delete a document and all associated data.

    This removes:
    - Questions associated with the document's quiz sessions
    - Quiz sessions for the document
    - Chunks in the database
    - Vector embeddings in Qdrant
    - The file in Supabase Storage
    - The document record itself

    Args:
        document_id: The ID of the document to delete.
        user_id: The authenticated user's ID (from token).

    Returns:
        204 No Content on success.

    Raises:
        HTTPException: 404 if document not found or doesn't belong to user.
        HTTPException: 500 if deletion fails.
    """
    try:
        # Verify document exists and belongs to user
        response = (
            supabase_admin.table("documents")
            .select("*")
            .eq("id", str(document_id))
            .eq("user_id", str(user_id))
            .execute()
        )

        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Document not found")

        doc = response.data[0]
        file_path = doc.get("file_path")

        # Delete questions via quiz_sessions
        # First get all session IDs for this document
        sessions_response = (
            supabase_admin.table("quiz_sessions")
            .select("id")
            .eq("document_id", str(document_id))
            .execute()
        )

        if sessions_response.data:
            session_ids = [s["id"] for s in sessions_response.data]
            # Delete questions for all sessions
            for session_id in session_ids:
                supabase_admin.table("questions").delete().eq(
                    "session_id", session_id
                ).execute()

        # Delete quiz_sessions
        supabase_admin.table("quiz_sessions").delete().eq(
            "document_id", str(document_id)
        ).execute()

        # Delete chunks
        supabase_admin.table("chunks").delete().eq(
            "document_id", str(document_id)
        ).execute()

        # Delete document record
        supabase_admin.table("documents").delete().eq("id", str(document_id)).execute()

        # Delete vectors from Qdrant (best-effort)
        try:
            delete_document_vectors(str(document_id))
        except Exception as e:
            logger.warning(f"Failed to delete vectors from Qdrant: {e}")

        # Delete file from storage (best-effort)
        if file_path:
            try:
                supabase_admin.storage.from_("documents").remove([file_path])
            except Exception as e:
                logger.warning(f"Failed to delete file from storage: {e}")

        return Response(status_code=204)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail="Failed to delete document"
        )


@router.get("/progress/summary", response_model=DocumentProgressSummaryResponse)
async def get_progress_summary(user_id: UUID = Depends(get_user_id_from_token)):
    """
    Get progress summary for all documents.

    Args:
        user_id: The authenticated user's ID.

    Returns:
        DocumentProgressSummaryResponse with list of progress summaries.
    """
    try:
        # Get all documents for user
        docs_response = (
            supabase_admin.table("documents")
            .select("id, ai_title, filename")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .execute()
        )

        if not docs_response.data:
            return DocumentProgressSummaryResponse(documents=[])

        doc_ids = [doc["id"] for doc in docs_response.data]
        concepts_by_doc: dict[str, list[dict]] = {doc_id: [] for doc_id in doc_ids}

        concepts_response = (
            supabase_admin.table("concepts")
            .select("id, document_id")
            .in_("document_id", doc_ids)
            .execute()
        )
        concept_rows = concepts_response.data or []

        concept_to_doc = {row["id"]: row["document_id"] for row in concept_rows}
        concept_ids = [row["id"] for row in concept_rows]

        mastery_map: dict[str, dict] = {}
        if concept_ids:
            mastery_response = (
                supabase_admin.table("user_concept_mastery")
                .select("concept_id, mastery_score, times_tested")
                .eq("user_id", str(user_id))
                .in_("concept_id", concept_ids)
                .execute()
            )
            mastery_map = {
                row["concept_id"]: row
                for row in (mastery_response.data or [])
                if row.get("concept_id")
            }

        for concept_id, document_id in concept_to_doc.items():
            mastery = mastery_map.get(concept_id, {})
            concepts_by_doc[document_id].append(
                {
                    "mastery_score": mastery.get("mastery_score", 0),
                    "times_tested": mastery.get("times_tested", 0),
                }
            )

        progress_list = []
        for doc in docs_response.data:
            doc_id = doc["id"]
            (
                total_concepts,
                practiced_concepts,
                weak_concepts,
                mastered_concepts,
                mastery_percent,
                milestone,
            ) = _calculate_progress(concepts_by_doc.get(doc_id, []))

            progress_list.append(
                DocumentProgressResponse(
                    document_id=UUID(doc_id),
                    document_title=doc.get("ai_title") or doc.get("filename"),
                    mastery_percent=mastery_percent,
                    concepts_total=total_concepts,
                    concepts_practiced=practiced_concepts,
                    weak_concepts_count=weak_concepts,
                    mastered_concepts_count=mastered_concepts,
                    milestone=milestone,
                )
            )

        return DocumentProgressSummaryResponse(documents=progress_list)

    except Exception as e:
        logger.error(f"[documents/progress] Failed to get summary: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get progress summary"
        )


@router.get("/{document_id}/progress", response_model=DocumentProgressResponse)
async def get_document_progress(
    document_id: UUID, user_id: UUID = Depends(get_user_id_from_token)
):
    """
    Get progress stats for a specific document.

    Args:
        document_id: The ID of the document.
        user_id: The authenticated user's ID.

    Returns:
        DocumentProgressResponse with detailed stats.
    """
    try:
        # Verify document exists
        doc_response = (
            supabase_admin.table("documents")
            .select("id, ai_title, filename")
            .eq("id", str(document_id))
            .eq("user_id", str(user_id))
            .execute()
        )

        if not doc_response.data:
            raise HTTPException(status_code=404, detail="Document not found")

        doc = doc_response.data[0]

        concepts = get_document_concepts(str(document_id), str(user_id))

        (
            total_concepts,
            practiced_concepts,
            weak_concepts,
            mastered_concepts,
            mastery_percent,
            milestone,
        ) = _calculate_progress(concepts)

        return DocumentProgressResponse(
            document_id=document_id,
            document_title=doc.get("ai_title") or doc.get("filename"),
            mastery_percent=mastery_percent,
            concepts_total=total_concepts,
            concepts_practiced=practiced_concepts,
            weak_concepts_count=weak_concepts,
            mastered_concepts_count=mastered_concepts,
            milestone=milestone,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[documents/progress] Failed to get progress: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get document progress"
        )

