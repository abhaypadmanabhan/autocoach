"""Loading + validation for golden eval tuples.

A golden tuple is one JSON object per line in ``golden/<doc>.jsonl``::

    {"question": "...", "source_chunk_text": "...",
     "ideal_answer": "...", "concept_label": "..."}

This module is stdlib-only so it is importable + testable without the app,
Qdrant, or any LLM keys. It does NOT fabricate ground truth — it only parses
+ validates what a human has curated, and refuses to run on template
placeholders.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

EVAL_DIR = Path(__file__).resolve().parent
GOLDEN_DIR = EVAL_DIR / "golden"
_BACKEND_DIR = EVAL_DIR.parent

# `source_chunk` (as the issue writes it) is accepted as an alias for
# `source_chunk_text` (the on-disk field name).
_REQUIRED_TUPLE_FIELDS = ("question", "ideal_answer")
_SOURCE_FIELD = "source_chunk_text"
_SOURCE_ALIAS = "source_chunk"
_ALL_TUPLE_FIELDS = frozenset(
    {*_REQUIRED_TUPLE_FIELDS, _SOURCE_FIELD, "concept_label"}
)

# Markers that indicate a tuple field still holds a template placeholder rather
# than real, human-curated content.
_TUPLE_PLACEHOLDER_TOKENS = (
    "REPLACE_WITH",
    "PLACEHOLDER",
    "TODO:",
    "<PASTE",
    "<FILL",
    "<INSERT",
    "FILL_ME",
    "YOUR_",
)


class TupleError(ValueError):
    """A golden tuple is structurally invalid or still a template placeholder."""


def _tuples_path(doc: str, *, golden_dir: Path = GOLDEN_DIR) -> Path:
    return golden_dir / f"{doc}.jsonl"


def _rel(path: Path) -> Path:
    try:
        return path.relative_to(_BACKEND_DIR)
    except ValueError:
        return path


def load_tuples(
    doc: str,
    limit: int | None = None,
    *,
    golden_dir: Path = GOLDEN_DIR,
) -> list[dict]:
    """Read + validate ``golden/<doc>.jsonl`` into a list of tuple dicts.

    Blank lines and lines starting with ``#`` are skipped. ``limit`` caps the
    number of tuples returned (handy for dry runs). Each tuple is normalized so
    the source field is always available as ``source_chunk_text``.

    Raises:
        FileNotFoundError: the jsonl file does not exist.
        TupleError: a line is not valid JSON or a tuple fails validation.
    """
    path = _tuples_path(doc, golden_dir=golden_dir)
    if not path.exists():
        raise FileNotFoundError(f"Missing golden tuples file: {path}")

    rows: list[dict] = []
    for lineno, line in enumerate(path.read_text().splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        try:
            row = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise TupleError(f"{_rel(path)}:{lineno} is not valid JSON: {exc}") from exc
        rows.append(validate_tuple(row, doc=doc, path=path, lineno=lineno))
        if limit is not None and len(rows) >= limit:
            break

    if not rows:
        logger.warning(
            "No tuples found in %s. Curate real (question, source_chunk, "
            "ideal_answer) tuples — see backend/evals/tuples/README.md.",
            _rel(path),
        )
    return rows


def validate_tuple(row: Any, *, doc: str, path: Path, lineno: int) -> dict:
    """Validate one decoded tuple object. Returns a normalized dict."""
    if not isinstance(row, dict):
        raise TupleError(
            f"{_rel(path)}:{lineno}: expected a JSON object, "
            f"got {type(row).__name__}."
        )

    # Normalize the source field alias.
    if _SOURCE_FIELD not in row and _SOURCE_ALIAS in row:
        row[_SOURCE_FIELD] = row.pop(_SOURCE_ALIAS)

    for field in (*_REQUIRED_TUPLE_FIELDS, _SOURCE_FIELD):
        if field not in row:
            raise TupleError(
                f"{_rel(path)}:{lineno}: missing required field '{field}'. "
                f"Required: question, source_chunk_text (or source_chunk), "
                f"ideal_answer. See backend/evals/tuples/README.md."
            )
        value = row[field]
        if not isinstance(value, str) or not value.strip():
            raise TupleError(
                f"{_rel(path)}:{lineno}: field '{field}' must be a non-empty string."
            )

    label = row.get("concept_label", "")
    if not isinstance(label, str):
        raise TupleError(
            f"{_rel(path)}:{lineno}: 'concept_label' must be a string, "
            f"got {type(label).__name__}."
        )
    row.setdefault("concept_label", "")

    # Reject tuples that still contain template placeholders — guards against
    # running evals on unfilled templates.
    for field in (*_REQUIRED_TUPLE_FIELDS, _SOURCE_FIELD):
        if _is_placeholder_text(row[field]):
            raise TupleError(
                f"{_rel(path)}:{lineno}: field '{field}' still looks like a "
                f"template placeholder ({row[field][:60]!r}…). Curate real "
                f"content before running the eval. See "
                f"backend/evals/tuples/README.md."
            )

    unknown = set(row) - _ALL_TUPLE_FIELDS
    if unknown:
        logger.warning(
            "%s:%d: unknown field(s) %s — kept but unused by the runner.",
            _rel(path), lineno, sorted(unknown),
        )

    return row


def _is_placeholder_text(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    upper = value.upper()
    return any(tok in upper for tok in _TUPLE_PLACEHOLDER_TOKENS)
