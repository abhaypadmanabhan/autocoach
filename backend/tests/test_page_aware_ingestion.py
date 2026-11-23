"""Page- and slide-aware ingestion: extraction units, chunk metadata, storage."""

import json
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from pptx import Presentation
from pptx.util import Inches

from app.core import qdrant as qdrant_module
from app.services import ingestion
from app.services.chunking import chunk_units
from app.services.text_extraction import (
    extract_pdf_pages,
    extract_pptx_slides,
    extract_text_from_pdf,
    extract_text_from_pptx,
)


def _pdf_with_pages(page_texts: list[str]) -> bytes:
    """Hand-written minimal PDF; an empty string makes a page with no text."""
    page_count = len(page_texts)
    first_page = 4
    page_ids = [first_page + 2 * i for i in range(page_count)]
    objects = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids ["
        + b" ".join(f"{pid} 0 R".encode() for pid in page_ids)
        + f"] /Count {page_count} >>".encode(),
        3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }
    for pid, text in zip(page_ids, page_texts):
        stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode() if text else b""
        objects[pid] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {pid + 1} 0 R >>"
        ).encode()
        objects[pid + 1] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream"
        )
    out = BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = {}
    for num in sorted(objects):
        offsets[num] = out.tell()
        out.write(f"{num} 0 obj\n".encode() + objects[num] + b"\nendobj\n")
    xref_at = out.tell()
    size = max(objects) + 1
    out.write(f"xref\n0 {size}\n0000000000 65535 f \n".encode())
    for num in range(1, size):
        out.write(f"{offsets[num]:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {size} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n".encode())
    return out.getvalue()


def _deck_with_table_and_notes() -> bytes:
    prs = Presentation()
    first = prs.slides.add_slide(prs.slide_layouts[5])
    first.shapes.title.text = "Intro slide"

    second = prs.slides.add_slide(prs.slide_layouts[5])
    second.shapes.title.text = "Replication modes"
    table = second.shapes.add_table(3, 2, Inches(1), Inches(2), Inches(6), Inches(2)).table
    for row, values in enumerate([("Mode", "Latency"), ("Sync", "High"), ("Async", "Low")]):
        for col, value in enumerate(values):
            table.cell(row, col).text = value
    group = second.shapes.add_group_shape()
    box = group.shapes.add_textbox(Inches(1), Inches(5), Inches(3), Inches(1))
    box.text_frame.text = "Grouped caption"
    second.notes_slide.notes_text_frame.text = "Mention leader election here."

    buf = BytesIO()
    prs.save(buf)
    return buf.getvalue()


def test_blank_middle_pdf_page_keeps_later_page_numbers():
    pdf = _pdf_with_pages(["Alpha page one text", "", "Gamma page three text"])

    units, page_count = extract_pdf_pages(pdf)
    chunks = chunk_units(units)

    assert page_count == 3
    assert [c["metadata"] for c in chunks] == [{"page": 1}, {"page": 3}]
    assert "Alpha" in chunks[0]["content"] and "Gamma" in chunks[1]["content"]
    assert [c["chunk_index"] for c in chunks] == [0, 1]
    full_text, count = extract_text_from_pdf(pdf)
    assert count == 3 and "Alpha" in full_text and "Gamma" in full_text


def test_slide_chunk_holds_header_paired_table_cells_group_text_and_notes():
    units, slide_count = extract_pptx_slides(_deck_with_table_and_notes())
    chunks = chunk_units(units)

    assert slide_count == 2
    slide_two = [c for c in chunks if c["metadata"] == {"slide": 2}]
    assert len(slide_two) == 1
    content = slide_two[0]["content"]
    assert content.startswith("Replication modes")
    assert "Mode: Sync; Latency: High" in content
    assert "Mode: Async; Latency: Low" in content
    assert "Grouped caption" in content
    assert "Notes: Mention leader election here." in content
    assert "Intro slide" not in content
    full_text, count = extract_text_from_pptx(_deck_with_table_and_notes())
    assert count == 2 and "Mode: Async; Latency: Low" in full_text


def test_chunks_never_span_units_and_index_is_document_wide():
    units = [
        {"text": "word " * 400, "metadata": {"page": 1}},
        {"text": "tiny", "metadata": {"page": 2}},
        {"text": "other " * 300, "metadata": {"page": 5}},
    ]
    chunks = chunk_units(units)

    assert [c["chunk_index"] for c in chunks] == list(range(len(chunks)))
    pages = [c["metadata"]["page"] for c in chunks]
    assert pages == sorted(pages) and set(pages) == {1, 2, 5}
    assert [c["content"] for c in chunks if c["metadata"] == {"page": 2}] == ["tiny"]
    assert all("word" not in c["content"] for c in chunks if c["metadata"]["page"] != 1)


def test_char_cap_applies_across_units_without_losing_numbers():
    units = [
        {"text": "a" * 60, "metadata": {"page": 1}},
        {"text": "b" * 60, "metadata": {"page": 2}},
        {"text": "c" * 60, "metadata": {"page": 3}},
    ]
    capped = ingestion._cap_units(units, 100)

    assert [u["metadata"] for u in capped] == [{"page": 1}, {"page": 2}]
    assert sum(len(u["text"]) for u in capped) == 100


def test_store_vectors_writes_location_keys_and_search_reads_them_back():
    chunks = [
        {"content": "slide text", "chunk_index": 0, "metadata": {"slide": 4}},
        {"content": "legacy text", "chunk_index": 1, "metadata": {}},
    ]
    with patch.object(qdrant_module.qdrant_client, "upsert") as upsert:
        qdrant_module.store_vectors("doc-id", chunks, [[0.1], [0.2]])
    payloads = [point.payload for point in upsert.call_args.kwargs["points"]]

    assert payloads[0]["slide"] == 4 and payloads[0]["metadata"] == {"slide": 4}
    assert "page" not in payloads[1] and "slide" not in payloads[1]

    points = [
        SimpleNamespace(id="p1", payload=payloads[0], score=0.9),
        SimpleNamespace(id="p2", payload=payloads[1], score=0.8),
        SimpleNamespace(id="p3", payload={"content": "old", "chunk_index": 2}, score=0.7),
    ]
    with patch.object(
        qdrant_module.qdrant_client,
        "query_points",
        return_value=SimpleNamespace(points=points),
    ):
        results = qdrant_module.search_vectors([0.1], "doc-id", top_k=3)

    assert [r["metadata"] for r in results] == [{"slide": 4}, {}, {}]


class _Recorder:
    """Minimal supabase stand-in that records chunk inserts."""

    def __init__(self, document):
        self.document = document
        self.inserted_chunks = []
        self.updates = []

    def table(self, name):
        return _Table(self, name)

    @property
    def storage(self):
        return SimpleNamespace(
            from_=lambda _bucket: SimpleNamespace(download=lambda _path: self.document["bytes"])
        )


class _Table:
    def __init__(self, db, name):
        self.db, self.name, self._op = db, name, None

    def update(self, data):
        self.db.updates.append((self.name, data))
        return self

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def insert(self, rows):
        if self.name == "chunks":
            self.db.inserted_chunks.extend(rows)
        return self

    def eq(self, *_a, **_k):
        return self

    def gte(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        if self.name == "documents" and self._op == "select":
            return SimpleNamespace(data=[self.db.document["row"]])
        return SimpleNamespace(data=[])


def test_process_document_stores_page_metadata_in_postgres_and_qdrant(monkeypatch):
    pdf = _pdf_with_pages(["Alpha page one text", "", "Gamma page three text"])
    db = _Recorder({
        "bytes": pdf,
        "row": {"id": "doc-1", "file_path": "u/doc.pdf", "file_type": "pdf", "user_id": "u"},
    })
    stored = {}
    monkeypatch.setattr(ingestion, "supabase_admin", db)
    monkeypatch.setattr(ingestion, "get_embeddings", lambda texts: [[0.0]] * len(texts))
    monkeypatch.setattr(
        ingestion,
        "store_vectors",
        lambda doc_id, chunks, emb: stored.setdefault("chunks", chunks) and ["p1", "p2"],
    )
    monkeypatch.setattr("app.services.concepts.extract_concepts", lambda *_a: None)
    monkeypatch.setattr("app.services.session_manager.create_session", lambda **_k: None)

    ingestion.process_document("doc-1")

    assert [r["metadata"] for r in db.inserted_chunks] == [{"page": 1}, {"page": 3}]
    assert [c["metadata"] for c in stored["chunks"]] == [{"page": 1}, {"page": 3}]
    assert ("documents", {"status": "ready", "chunk_count": 2, "page_count": 3}) in db.updates


def test_chunk_cap_is_logged_as_structured_truncation(monkeypatch, caplog):
    pdf = _pdf_with_pages(["Alpha page one text", "Beta page two text", "Gamma page three text"])
    db = _Recorder({
        "bytes": pdf,
        "row": {"id": "doc-2", "file_path": "u/doc.pdf", "file_type": "pdf", "user_id": "u"},
    })
    monkeypatch.setattr(ingestion, "MAX_CHUNKS", 2)
    monkeypatch.setattr(ingestion, "supabase_admin", db)
    monkeypatch.setattr(ingestion, "get_embeddings", lambda texts: [[0.0]] * len(texts))
    monkeypatch.setattr(ingestion, "store_vectors", lambda _d, chunks, _e: ["p"] * len(chunks))
    monkeypatch.setattr("app.services.concepts.extract_concepts", lambda *_a: None)
    monkeypatch.setattr("app.services.session_manager.create_session", lambda **_k: None)

    with caplog.at_level("WARNING", logger="app.services.ingestion"):
        ingestion.process_document("doc-2")

    record = next(r.getMessage() for r in caplog.records if "ingestion.truncated" in r.getMessage())
    payload = json.loads(record.split(" ", 1)[1])
    assert payload["document_id"] == "doc-2"
    assert payload["chunks_total"] == 3 and payload["chunks_kept"] == 2
    assert payload["last_kept_unit"] == {"page": 2}
    assert [r["metadata"] for r in db.inserted_chunks] == [{"page": 1}, {"page": 2}]
