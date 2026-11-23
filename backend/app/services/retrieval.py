"""RAG retrieval service for searching relevant document chunks."""

import logging
import math
import re
import threading
from collections import Counter, OrderedDict

from app.core.supabase import supabase_admin
from app.observability.langfuse import observe
from app.services.embeddings import get_embeddings
from app.core.qdrant import search_vectors

logger = logging.getLogger(__name__)


@observe(
    name="retrieval.qdrant",
    as_type="span",
    capture_input=False,
    capture_output=False,
)
def retrieve_relevant_chunks(query: str, document_id: str, top_k: int = 5) -> list[dict]:
    """
    Retrieve relevant chunks from a document based on a query.

    Args:
        query: The search query text.
        document_id: The ID of the document to search within.
        top_k: Number of top results to return.

    Returns:
        List of dictionaries containing chunk information:
        [{"id": str, "content": str, "chunk_index": int, "score": float}]
        where "id" is the stable Qdrant point ID.
    """
    try:
        # Get embedding for the query
        embeddings = get_embeddings([query])
        if not embeddings:
            logger.error("Failed to generate embedding for query")
            return []
        
        query_embedding = embeddings[0]
        
        # Search vectors in Qdrant
        results = search_vectors(
            query_embedding=query_embedding,
            document_id=document_id,
            top_k=top_k
        )
        
        logger.info(f"Retrieved {len(results)} relevant chunks for document {document_id}")
        return results
    except Exception as e:
        logger.error(f"Failed to retrieve relevant chunks: {e}")
        return []


# ---------------------------------------------------------------------------
# Hybrid retrieval for one concept: dense (Qdrant) + BM25, fused by RRF
# ---------------------------------------------------------------------------

#: Supabase returns at most this many rows per request.
_PAGE_ROWS = 1000
#: Documents whose BM25 index is kept in memory.
_CACHE_DOCUMENTS = 8
#: Reciprocal rank fusion constant (Cormack et al. 2009).
_RRF_K = 60
_BM25_K1 = 1.5
_BM25_B = 0.75
MAX_CONTEXT_CHARS = 12000

_TOKEN = re.compile(r"\w+", re.UNICODE)


def _tokens(text: str) -> list[str]:
    return [t for t in _TOKEN.findall((text or "").casefold()) if len(t) > 1]


class _Bm25Index:
    """Okapi BM25 over one document's chunks, held in memory."""

    def __init__(self, chunks: list[dict]):
        self.chunks = chunks
        self.term_freqs = [Counter(_tokens(c.get("content", ""))) for c in chunks]
        self.lengths = [sum(tf.values()) for tf in self.term_freqs]
        self.avg_length = (sum(self.lengths) / len(self.lengths)) if chunks else 0.0
        doc_freq: Counter = Counter()
        for tf in self.term_freqs:
            doc_freq.update(tf.keys())
        n = len(chunks)
        self.idf = {
            term: math.log((n - df + 0.5) / (df + 0.5) + 1.0)
            for term, df in doc_freq.items()
        }

    def rank(self, query: str) -> list[int]:
        """Positions into `chunks`, best first; chunks sharing no query term
        are left out."""
        terms = set(_tokens(query)) & self.idf.keys()
        scored = []
        for pos, tf in enumerate(self.term_freqs):
            norm = _BM25_K1 * (1 - _BM25_B + _BM25_B * self.lengths[pos] / (self.avg_length or 1))
            score = sum(
                self.idf[t] * tf[t] * (_BM25_K1 + 1) / (tf[t] + norm)
                for t in terms
                if tf[t]
            )
            if score > 0:
                scored.append((score, pos))
        scored.sort(key=lambda s: (-s[0], s[1]))
        return [pos for _, pos in scored]


_index_cache: "OrderedDict[str, tuple[int, _Bm25Index]]" = OrderedDict()
_index_lock = threading.Lock()


def _chunk_count(document_id: str) -> int:
    res = (
        supabase_admin.table("chunks")
        .select("id", count="exact")
        .eq("document_id", document_id)
        .limit(1)
        .execute()
    )
    return res.count or 0


def _load_chunks(document_id: str) -> list[dict]:
    """Every chunk row of a document in order, paging past Supabase's
    1000-row response limit."""
    rows: list[dict] = []
    while True:
        res = (
            supabase_admin.table("chunks")
            .select("id, content, chunk_index, metadata")
            .eq("document_id", document_id)
            .order("chunk_index")
            .range(len(rows), len(rows) + _PAGE_ROWS - 1)
            .execute()
        )
        page = res.data or []
        rows.extend(page)
        if len(page) < _PAGE_ROWS:
            return rows


def _document_index(document_id: str) -> _Bm25Index:
    """BM25 index for a document, cached per (document, chunk count) so a
    re-ingested document is rebuilt rather than served stale."""
    count = _chunk_count(document_id)
    with _index_lock:
        cached = _index_cache.get(document_id)
        if cached and cached[0] == count:
            _index_cache.move_to_end(document_id)
            return cached[1]
    index = _Bm25Index(_load_chunks(document_id) if count else [])
    with _index_lock:
        _index_cache[document_id] = (count, index)
        _index_cache.move_to_end(document_id)
        while len(_index_cache) > _CACHE_DOCUMENTS:
            _index_cache.popitem(last=False)
    return index


def _dense_ranking(query: str, document_id: str, limit: int) -> list[int]:
    """chunk_index values from the vector search, best first; [] when the
    embedding or vector service is down."""
    try:
        embeddings = get_embeddings([query])
        if not embeddings:
            return []
        hits = search_vectors(query_embedding=embeddings[0], document_id=document_id, top_k=limit)
        return [h["chunk_index"] for h in hits]
    except Exception as e:
        logger.warning("Dense search failed for document %s, using BM25 only: %s", document_id, e)
        return []


@observe(
    name="retrieval.hybrid",
    as_type="span",
    capture_input=False,
    capture_output=False,
)
def retrieve_for_concept(document_id: str, concept: dict, top_k: int = 6) -> list[dict]:
    """Passages that explain one concept of a document.

    Dense search on "name: description" and in-process BM25 over the
    document's chunks are fused by reciprocal rank fusion. Each of the top
    `top_k` hits brings its neighbours (chunk_index +-1) for continuity. The
    result is in document order and capped near MAX_CONTEXT_CHARS, hits
    before neighbours.

    Returns `[{id, content, chunk_index, metadata, score}]`, where `id` is the
    Postgres chunk id, `metadata` the chunk row's metadata (`{}` when absent)
    and `score` the fused score (0.0 for a neighbour that was not a hit).
    Degrades to BM25 alone when dense search fails; `[]` when nothing matches.
    """
    name = concept.get("concept_name") or concept.get("name") or ""
    description = concept.get("concept_description") or concept.get("description") or ""
    query = f"{name}: {description}" if description else name

    index = _document_index(document_id)
    if not index.chunks:
        return []
    by_chunk_index = {c["chunk_index"]: c for c in index.chunks}

    fused: dict[int, float] = {}
    lexical = [index.chunks[pos]["chunk_index"] for pos in index.rank(query)[: top_k * 2]]
    dense = [i for i in _dense_ranking(query, document_id, top_k * 2) if i in by_chunk_index]
    for ranking in (dense, lexical):
        for rank, chunk_index in enumerate(ranking):
            fused[chunk_index] = fused.get(chunk_index, 0.0) + 1.0 / (_RRF_K + rank + 1)
    hits = {i: fused[i] for i in sorted(fused, key=lambda i: (-fused[i], i))[:top_k]}

    chosen: list[int] = []
    total = 0
    for hit in hits:
        for chunk_index in (hit, hit - 1, hit + 1):
            chunk = by_chunk_index.get(chunk_index)
            if chunk is None or chunk_index in chosen:
                continue
            length = len(chunk.get("content") or "")
            if chosen and total + length > MAX_CONTEXT_CHARS:
                continue
            chosen.append(chunk_index)
            total += length

    logger.info(
        "retrieve_for_concept: %d hits (%d dense, %d lexical) -> %d passages, %d chars",
        len(hits), len(dense), len(lexical), len(chosen), total,
    )
    return [
        {
            "id": by_chunk_index[i].get("id"),
            "content": by_chunk_index[i].get("content") or "",
            "chunk_index": i,
            "metadata": by_chunk_index[i].get("metadata") or {},
            "score": hits.get(i, 0.0),
        }
        for i in sorted(chosen)
    ]
