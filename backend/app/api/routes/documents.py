from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
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
)
from app.services.abuse_controls import enforce_max_documents
from app.services.ingestion import process_document
from app.services.retrieval import retrieve_relevant_chunks

router = APIRouter()

settings = get_settings()

# Constants for file validation
ALLOWED_EXTENSIONS = {".pdf", ".pptx"}
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
            status_code=401, detail=f"Token validation failed: {str(e)}"
        )


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
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

    # Enforce document quota before reading file
    enforce_max_documents(user_id, settings.max_documents_per_user)

    # Read file bytes
    file_bytes = await file.read()
    file_size = len(file_bytes)

    # Validate file size
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
            raise HTTPException(
                status_code=500,
                detail=f"Storage upload failed: {storage_response.error}",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to upload file to storage: {str(e)}"
        )

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
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create document record: {str(e)}"
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
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to register document: {str(e)}"
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

        documents = [
            DocumentResponse(
                id=UUID(doc["id"]),
                filename=doc["filename"],
                file_type=doc["file_type"],
                file_size=doc["file_size"],
                status=doc["status"],
                created_at=doc["created_at"],
            )
            for doc in response.data
        ]

        return DocumentListResponse(documents=documents)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch documents: {str(e)}"
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

        return DocumentResponse(
            id=UUID(doc["id"]),
            filename=doc["filename"],
            file_type=doc["file_type"],
            file_size=doc["file_size"],
            status=doc["status"],
            created_at=doc["created_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch document: {str(e)}"
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
            status_code=500, detail=f"Failed to search document: {str(e)}"
        )


logger = logging.getLogger(__name__)


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
        supabase_admin.table("documents").delete().eq(
            "id", str(document_id)
        ).execute()

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
            status_code=500, detail=f"Failed to delete document: {str(e)}"
        )
