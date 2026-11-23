"""Hybrid retrieval (dense + BM25, fused by RRF) for one concept.

The old targeted retrieval counted substrings, so a chunk repeating a common
word from the concept description outranked the one chunk that names the
concept. These tests pin the replacement's ranking, its fallbacks and its
cache.
"""

from types import SimpleNamespace

import pytest

from app.services import quiz_generator, retrieval

DOC_ID = "doc-1"
CONCEPT_ID = "concept-raft"
RAFT = {
    "id": CONCEPT_ID,
    "concept_name": "Raft",
    "concept_description": "A consensus algorithm that keeps replicated data consistent",
}


class _Query:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.filters, self.count, self.window, self.order_by = [], None, None, None

    def select(self, _columns, count=None):
        self.count = count
        return self

    def eq(self, column, value):
        self.filters.append(lambda r: r.get(column) == value)
        return self

    def in_(self, column, values):
        self.filters.append(lambda r: r.get(column) in values)
        return self

    def order(self, column):
        self.order_by = column
        return self

    def range(self, start, end):
        self.window = (start, end + 1)
        return self

    def limit(self, n):
        self.window = (0, n)
        return self

    def execute(self):
        self.db.calls.append((self.table, self.window))
        rows = [r for r in self.db.tables.get(self.table, []) if all(f(r) for f in self.filters)]
        if self.order_by:
            rows.sort(key=lambda r: r[self.order_by])
        total = len(rows)
        if self.window:
            rows = rows[self.window[0] : self.window[1]]
        return SimpleNamespace(data=rows, count=total if self.count else None)


class FakeSupabase:
    def __init__(self, **tables):
        self.tables = tables
        self.calls = []

    def table(self, name):
        return _Query(self, name)


def _chunk(index, content, metadata=None):
    return {
        "id": f"row-{index}",
        "document_id": DOC_ID,
        "chunk_index": index,
        "content": content,
        "metadata": metadata if metadata is not None else {},
    }


@pytest.fixture(autouse=True)
def _empty_cache():
    # getattr: the end-to-end test must also run (and fail on its assertion)
    # against the retrieval module from before the hybrid index existed.
    cache = getattr(retrieval, "_index_cache", {})
    cache.clear()
    yield
    cache.clear()


def _install(monkeypatch, chunks, dense=None, concepts=()):
    """Serve `chunks` from Postgres; `dense` is a list of chunk_index values
    the vector search returns, or an Exception it raises."""
    db = FakeSupabase(chunks=list(chunks), concepts=list(concepts))
    monkeypatch.setattr(retrieval, "supabase_admin", db, raising=False)
    monkeypatch.setattr(quiz_generator, "supabase_admin", db)
    monkeypatch.setattr(retrieval, "get_embeddings", lambda texts: [[0.0] * 3 for _ in texts])

    def fake_search(query_embedding, document_id, top_k=5, **_kw):
        if isinstance(dense, Exception):
            raise dense
        return [
            {"id": f"point-{i}", "content": "", "chunk_index": i, "score": 1.0}
            for i in (dense or [])[:top_k]
        ]

    monkeypatch.setattr(retrieval, "search_vectors", fake_search)
    return db


FILLER = "the data data data data data stored data written data read data. " * 25


def _raft_document():
    """Ten long chunks that repeat the description's common word "data",
    then one chunk that names the concept."""
    chunks = [_chunk(i, f"Section {i}. " + FILLER) for i in range(10)]
    chunks.append(_chunk(10, "Raft elects a leader and replicates a log to followers."))
    return chunks


def test_targeted_generation_prompt_contains_the_chunk_that_names_the_concept(monkeypatch):
    """End to end through targeted generation: the passage naming a rare
    concept must reach the model even when common description words fill
    many other chunks (the old substring counter dropped it)."""
    _install(monkeypatch, _raft_document(), dense=RuntimeError("qdrant down"), concepts=[RAFT])
    prompts = []

    def fake_call_kimi(_system, user, **_kwargs):
        prompts.append(user)
        return ""

    monkeypatch.setattr(quiz_generator, "call_kimi", fake_call_kimi)
    monkeypatch.setattr(quiz_generator, "call_openai", lambda *_a, **_k: "")

    quiz_generator.generate_quiz_questions(
        document_id=DOC_ID,
        num_questions=1,
        question_types=["text_mcq"],
        target_concepts=[{"name": RAFT["concept_name"], "description": RAFT["concept_description"]}],
        focus_concept_ids=[CONCEPT_ID],
    )

    assert prompts, "generator never called the model"
    assert "Raft elects a leader" in prompts[0]


def test_rare_concept_name_outranks_repeated_common_word(monkeypatch):
    _install(monkeypatch, _raft_document(), dense=[])

    result = retrieval.retrieve_for_concept(DOC_ID, RAFT, top_k=1)

    assert [c["chunk_index"] for c in result] == [9, 10]  # the hit plus its neighbour
    assert result[1]["score"] > 0
    assert result[0]["score"] == 0.0  # neighbour only


def test_rrf_prefers_chunks_both_rankings_agree_on(monkeypatch):
    chunks = [
        _chunk(0, "Raft consensus overview."),
        _chunk(1, "Unrelated text about cooking."),
        _chunk(2, "More unrelated text about gardening."),
        _chunk(3, "Raft leader election in detail."),
    ]
    # Dense likes 2 then 3; BM25 likes 0 and 3. Chunk 3 is in both.
    _install(monkeypatch, chunks, dense=[2, 3])

    result = retrieval.retrieve_for_concept(DOC_ID, {"concept_name": "Raft"}, top_k=1)

    scored = [c for c in result if c["score"] > 0]
    assert [c["chunk_index"] for c in scored] == [3]


def test_neighbours_are_added_deduplicated_and_in_document_order(monkeypatch):
    chunks = [_chunk(i, f"plain text {i}") for i in range(8)]
    _install(monkeypatch, chunks, dense=[5, 4, 1])

    result = retrieval.retrieve_for_concept(DOC_ID, {"concept_name": "zzz"}, top_k=3)

    # hits 5, 4, 1 bring 6, 3 and 0, 2; 4 and 5 are each other's neighbours.
    assert [c["chunk_index"] for c in result] == [0, 1, 2, 3, 4, 5, 6]
    assert {c["id"] for c in result} == {f"row-{i}" for i in range(7)}


def test_result_carries_row_metadata_and_respects_char_cap(monkeypatch):
    big = "x" * 7000
    chunks = [_chunk(i, f"raft {big}", {"page": i + 1}) for i in range(4)]
    _install(monkeypatch, chunks, dense=[2])

    result = retrieval.retrieve_for_concept(DOC_ID, {"concept_name": "raft"}, top_k=6)

    assert len(result) == 1  # a second 7,000-char passage would pass the 12,000 cap
    assert result[0]["chunk_index"] == 2
    assert result[0]["metadata"] == {"page": 3}


def test_dense_failure_falls_back_to_bm25(monkeypatch):
    chunks = [_chunk(0, "cooking"), _chunk(1, "Raft log replication"), _chunk(2, "gardening")]
    _install(monkeypatch, chunks, dense=RuntimeError("qdrant down"))

    result = retrieval.retrieve_for_concept(DOC_ID, {"concept_name": "Raft"}, top_k=1)

    assert 1 in [c["chunk_index"] for c in result]
    assert next(c for c in result if c["chunk_index"] == 1)["score"] > 0


def test_zero_match_concept_returns_nothing_not_the_first_chunks(monkeypatch):
    chunks = [_chunk(i, f"cooking recipe {i}") for i in range(5)]
    _install(monkeypatch, chunks, dense=[])

    assert retrieval.retrieve_for_concept(DOC_ID, {"concept_name": "Raft"}) == []


def test_no_chunks_returns_empty(monkeypatch):
    _install(monkeypatch, [], dense=[1, 2])

    assert retrieval.retrieve_for_concept(DOC_ID, {"concept_name": "Raft"}) == []


def test_cache_reused_until_chunk_count_changes(monkeypatch):
    db = _install(monkeypatch, [_chunk(0, "Raft one")], dense=[])

    first = retrieval.retrieve_for_concept(DOC_ID, {"concept_name": "Raft"})
    loads = [c for c in db.calls if c[0] == "chunks" and c[1] != (0, 1)]
    retrieval.retrieve_for_concept(DOC_ID, {"concept_name": "Raft"})
    assert [c for c in db.calls if c[0] == "chunks" and c[1] != (0, 1)] == loads  # cached

    db.tables["chunks"] = [_chunk(0, "cooking"), _chunk(1, "Raft two")]
    second = retrieval.retrieve_for_concept(DOC_ID, {"concept_name": "Raft"})

    assert [c["content"] for c in first] == ["Raft one"]
    assert "Raft two" in [c["content"] for c in second]


def test_loads_every_page_past_the_supabase_row_limit(monkeypatch):
    chunks = [_chunk(i, f"filler {i}") for i in range(2500)]
    chunks[2400]["content"] = "Raft appears only here"
    _install(monkeypatch, chunks, dense=[])

    result = retrieval.retrieve_for_concept(DOC_ID, {"concept_name": "Raft"}, top_k=1)

    assert 2400 in [c["chunk_index"] for c in result]
