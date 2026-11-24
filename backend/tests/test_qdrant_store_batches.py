"""store_vectors must upsert in bounded batches: Qdrant rejects a request
body over 32 MB, which one upsert of ~1,000 points with 1536-dim vectors
exceeds (seen live 2026-11-23 on a 1,274-chunk document)."""

from unittest.mock import patch

import pytest

from app.core import qdrant as qdrant_module


def _chunks(n):
    return [{"content": f"chunk {i}", "chunk_index": i, "metadata": {"page": i + 1}} for i in range(n)]


def test_large_document_is_upserted_in_bounded_batches():
    n = 2 * qdrant_module.UPSERT_BATCH_SIZE + 37
    with patch.object(qdrant_module.qdrant_client, "upsert") as upsert:
        ids = qdrant_module.store_vectors("doc-id", _chunks(n), [[0.1] * 3] * n)

    sizes = [len(call.kwargs["points"]) for call in upsert.call_args_list]
    assert sizes == [qdrant_module.UPSERT_BATCH_SIZE, qdrant_module.UPSERT_BATCH_SIZE, 37]
    sent = [p for call in upsert.call_args_list for p in call.kwargs["points"]]
    assert [p.id for p in sent] == ids
    assert [p.payload["chunk_index"] for p in sent] == list(range(n))


def test_a_failed_batch_removes_the_points_already_stored():
    n = qdrant_module.UPSERT_BATCH_SIZE + 1
    with patch.object(
        qdrant_module.qdrant_client, "upsert", side_effect=[None, RuntimeError("boom")]
    ), patch.object(qdrant_module, "delete_document_vectors") as cleanup:
        with pytest.raises(RuntimeError):
            qdrant_module.store_vectors("doc-id", _chunks(n), [[0.1] * 3] * n)

    cleanup.assert_called_once_with("doc-id", "documents")
