"""Tests for Qdrant vector search result formatting."""

from types import SimpleNamespace
from unittest.mock import patch

from app.core import qdrant as qdrant_module


def test_search_vectors_includes_stable_point_id():
    points = [
        SimpleNamespace(
            id="11111111-1111-1111-1111-111111111111",
            payload={"content": "TEST FIXTURE chunk one", "chunk_index": 0},
            score=0.9,
        ),
        SimpleNamespace(
            id="22222222-2222-2222-2222-222222222222",
            payload={"content": "TEST FIXTURE chunk two", "chunk_index": 1},
            score=0.8,
        ),
    ]
    with patch.object(
        qdrant_module.qdrant_client,
        "query_points",
        return_value=SimpleNamespace(points=points),
    ):
        results = qdrant_module.search_vectors([0.1] * 3, "doc-id", top_k=2)

    assert results == [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "content": "TEST FIXTURE chunk one",
            "chunk_index": 0,
            "score": 0.9,
        },
        {
            "id": "22222222-2222-2222-2222-222222222222",
            "content": "TEST FIXTURE chunk two",
            "chunk_index": 1,
            "score": 0.8,
        },
    ]
