"""Whole-document concept extraction, evidence persistence and coverage metric."""

import json
from types import SimpleNamespace

import pytest

from app.services import concepts
from evals.concept_coverage import coverage_for_document, decile_coverage


class _Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self._insert, self._range = db, table, {}, None, None

    def select(self, *_a, **_k):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def in_(self, column, values):
        self.filters[column + "__in"] = list(values)
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def insert(self, data):
        self._insert = data
        return self

    def update(self, *_a, **_k):
        return self

    def execute(self):
        return SimpleNamespace(data=self.db.run(self))


class _FakeDb:
    """Chunks of one document with ids `id-<chunk_index>`."""

    def __init__(self, total_chunks, stored_concepts=None):
        self.total_chunks = total_chunks
        self.stored_concepts = stored_concepts or []
        self.inserted = []
        self.chunk_lookups = []

    def table(self, name):
        return _Query(self, name)

    def run(self, q):
        if q._insert is not None:
            self.inserted.append(q._insert)
            return [{"id": f"concept-{len(self.inserted)}"}]
        if q.table == "chunks":
            assert q.filters.get("document_id") == "doc"
            rows = [{"id": f"id-{i}", "chunk_index": i} for i in range(self.total_chunks)]
            if "chunk_index__in" in q.filters:
                self.chunk_lookups.append(q.filters["chunk_index__in"])
                rows = [r for r in rows if r["chunk_index"] in q.filters["chunk_index__in"]]
            if q._range:
                rows = rows[q._range[0]:q._range[1] + 1]
            return rows
        if q.table == "documents":
            return [{"chunk_count": self.total_chunks}]
        if q.table == "concepts" and "document_id" in q.filters and q._insert is None:
            return self.stored_concepts
        return []


def _chunks(n, size=60):
    return [
        {"content": f"passage {i} " + "x" * size, "chunk_index": i, "metadata": {"page": i + 1}}
        for i in range(n)
    ]


def _concept(name, evidence=None):
    item = {
        "concept_name": name,
        "concept_description": f"{name} described.",
        "importance_score": 3,
        "prerequisites": [],
        "why_important": "Because.",
    }
    if evidence is not None:
        item["evidence_chunks"] = evidence
    return item


def _run(monkeypatch, chunks, response_concepts, total_chunks=None):
    db = _FakeDb(total_chunks if total_chunks is not None else len(chunks))
    captured = {}

    def fake_call_kimi(system_prompt, user_prompt, **kwargs):
        captured.update(system=system_prompt, user=user_prompt, kwargs=kwargs)
        return json.dumps({"concepts": response_concepts})

    monkeypatch.setattr(concepts, "supabase_admin", db)
    monkeypatch.setattr(concepts, "call_kimi", fake_call_kimi)
    monkeypatch.setattr(concepts, "generate_ai_title", lambda *_a, **_k: None)
    concepts.extract_concepts("doc", chunks)
    return db, captured


def _envelope(user_prompt):
    start = user_prompt.index(concepts.DOCUMENT_CONTENT_OPEN_TAG) + len(concepts.DOCUMENT_CONTENT_OPEN_TAG)
    return user_prompt[start:user_prompt.index(concepts.DOCUMENT_CONTENT_CLOSE_TAG)].strip()


def test_document_within_budget_sends_every_chunk_including_the_last(monkeypatch):
    _db, captured = _run(monkeypatch, _chunks(300), [_concept("Replication")])

    assert "passage 299 " in captured["user"]
    assert "[chunk 0] passage 0 " in captured["user"]
    assert "[chunk 150] passage 150 " in captured["user"]
    assert "[chunk 299] passage 299 " in captured["user"]
    assert "evidence_chunks" in captured["user"]
    assert captured["kwargs"]["max_tokens"] >= 8000


def test_over_budget_document_samples_windows_covering_both_ends(monkeypatch):
    budget_tokens = 2_000
    monkeypatch.setattr(concepts, "CONCEPT_PROMPT_BUDGET_TOKENS", budget_tokens)
    _db, captured = _run(monkeypatch, _chunks(1000), [_concept("Replication")])

    body = _envelope(captured["user"])
    sent = [int(line.split("]")[0].removeprefix("[chunk ")) for line in body.split("\n\n")]
    assert sent[0] == 0 and sent[-1] == 999
    assert len(body) <= budget_tokens * concepts.CHARS_PER_TOKEN
    assert 0 < len(sent) < 1000
    middle = [i for i in sent if 400 <= i < 600]
    assert middle, "a middle window is sampled too"


def test_evidence_indices_map_to_chunk_ids_and_unknown_ones_are_dropped(monkeypatch):
    db, _captured = _run(
        monkeypatch,
        _chunks(12),
        [
            _concept("Replication", [3, 7, 3, 9999, -1, "x"]),
            _concept("Partitioning", []),
            _concept("Consensus"),
        ],
    )

    by_name = {row["concept_name"]: row for row in db.inserted}
    assert by_name["Replication"]["chunk_ids"] == ["id-3", "id-7"]
    assert "chunk_ids" not in by_name["Partitioning"]
    assert "chunk_ids" not in by_name["Consensus"]
    assert db.chunk_lookups == [[3, 7, 9999]]


def test_existing_concepts_still_skip_extraction(monkeypatch):
    db = _FakeDb(5, stored_concepts=[{"id": "c1"}])
    called = []
    monkeypatch.setattr(concepts, "supabase_admin", db)
    monkeypatch.setattr(concepts, "call_kimi", lambda *a, **k: called.append(1))

    concepts.extract_concepts("doc", _chunks(5))

    assert called == [] and db.inserted == []


@pytest.mark.parametrize(
    ("indices", "total", "expected"),
    [
        ([0], 100, 0.1),
        ([0, 99], 100, 0.2),
        (range(20), 100, 0.2),
        (range(20), 300, 0.1),
        ([5, 15, 25, 35, 45, 55, 65, 75, 85, 95], 100, 1.0),
        ([0, 4], 5, 0.4),
        ([-1, 100, 150], 100, 0.0),
        ([], 10, 0.0),
        ([1], 0, 0.0),
    ],
)
def test_decile_coverage(indices, total, expected):
    assert decile_coverage(indices, total) == pytest.approx(expected)


def test_coverage_cli_reads_chunk_ids_through_the_document(monkeypatch):
    db = _FakeDb(
        1500,
        stored_concepts=[
            {"chunk_ids": ["id-0", "id-1499"]},
            {"chunk_ids": ["id-1200", "unknown-id"]},
            {"chunk_ids": None},
        ],
    )

    result = coverage_for_document(db, "doc")

    assert result["total_chunks"] == 1500
    assert result["evidence_chunks"] == 3
    assert result["coverage"] == pytest.approx(0.3)  # deciles 0, 8 and 9
    assert result["legacy_first20_coverage"] == pytest.approx(0.1)
