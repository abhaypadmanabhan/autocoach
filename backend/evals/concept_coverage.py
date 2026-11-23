"""Concept coverage: how much of a document its extracted concepts draw on.

A document is split into ten deciles by chunk_index. Coverage is the share of
deciles holding at least one chunk cited as a concept's evidence
(``concepts.chunk_ids``). Concepts drawn from the first 20 chunks only (the old
extraction rule) cover the opening deciles of a long document and nothing else.

Read-only; run after ingesting a document::

    python -m evals.concept_coverage --document-id <uuid>

It prints the coverage of the stored concepts and, for comparison, the best
coverage the old first-20-chunks rule could have reached on the same document.
"""

from __future__ import annotations

import argparse
from typing import Iterable

LEGACY_SAMPLE_CHUNKS = 20
_PAGE_SIZE = 1000


def decile_coverage(evidence_chunk_indices: Iterable[int], total_chunks: int) -> float:
    """Share of the document's deciles containing at least one evidence chunk.

    Chunk i falls in decile ``i * 10 // total_chunks``. A document with fewer
    than ten chunks has one decile per chunk. Indices outside the document are
    ignored.
    """
    if total_chunks <= 0:
        return 0.0
    deciles = {i * 10 // total_chunks for i in range(total_chunks)}
    hit = {
        i * 10 // total_chunks
        for i in evidence_chunk_indices
        if 0 <= i < total_chunks
    }
    return len(hit) / len(deciles)


def coverage_for_document(db, document_id: str) -> dict:
    """Coverage numbers for one document, read through its document_id."""
    doc = db.table("documents").select("chunk_count").eq("id", document_id).execute()
    if not doc.data:
        raise SystemExit(f"document {document_id} not found")
    total_chunks = doc.data[0].get("chunk_count") or 0

    concepts = db.table("concepts").select("chunk_ids").eq("document_id", document_id).execute()
    evidence_ids = {cid for row in concepts.data or [] for cid in (row.get("chunk_ids") or [])}

    index_by_id: dict[str, int] = {}
    start = 0
    while True:
        page = (
            db.table("chunks")
            .select("id, chunk_index")
            .eq("document_id", document_id)
            .order("chunk_index")
            .range(start, start + _PAGE_SIZE - 1)
            .execute()
        )
        rows = page.data or []
        index_by_id.update({row["id"]: row["chunk_index"] for row in rows})
        if len(rows) < _PAGE_SIZE:
            break
        start += _PAGE_SIZE

    evidence_indices = sorted(index_by_id[cid] for cid in evidence_ids if cid in index_by_id)
    return {
        "document_id": document_id,
        "total_chunks": total_chunks,
        "concepts": len(concepts.data or []),
        "evidence_chunks": len(evidence_indices),
        "coverage": decile_coverage(evidence_indices, total_chunks),
        "legacy_first20_coverage": decile_coverage(
            range(min(LEGACY_SAMPLE_CHUNKS, total_chunks)), total_chunks
        ),
    }


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--document-id", required=True)
    args = parser.parse_args(argv)

    from app.core.supabase import supabase_admin

    result = coverage_for_document(supabase_admin, args.document_id)
    print(
        f"document {result['document_id']}: {result['total_chunks']} chunks, "
        f"{result['concepts']} concepts, {result['evidence_chunks']} evidence chunks"
    )
    print(f"decile coverage (stored concepts): {result['coverage']:.2f}")
    print(f"decile coverage (old first-20-chunks rule, best case): {result['legacy_first20_coverage']:.2f}")


if __name__ == "__main__":
    main()
