"""Config schema + validation for the Ragas eval harness (stdlib-only).

A per-doc config (``backend/evals/golden/<doc>.config.json``) maps a golden doc
slug to the real ``documents.id`` UUID in dev Supabase. Until a human uploads
the PDF and pastes the real UUID, the config holds a placeholder; the
validator turns that into an actionable error instead of a confusing Qdrant
lookup failure downstream. Importable + testable without the app or LLM keys.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

EVAL_DIR = Path(__file__).resolve().parent
GOLDEN_DIR = EVAL_DIR / "golden"
_BACKEND_DIR = EVAL_DIR.parent  # for relative paths in error messages

_REQUIRED_FIELDS = ("document_id",)
_KNOWN_FIELDS = frozenset({"document_id", "label", "top_k", "notes"})
_PLACEHOLDER_TOKENS = ("REPLACE_WITH", "PLACEHOLDER", "TODO", "YOUR_", "XXX")

DEFAULT_TOP_K = 5


class ConfigError(ValueError):
    """Config is structurally invalid (bad JSON / wrong types / missing field)."""


class PlaceholderDocIdError(ConfigError):
    """``document_id`` is still a placeholder or not a valid UUID."""


@dataclass(frozen=True)
class EvalConfig:
    doc: str
    document_id: str
    label: str
    top_k: int
    notes: str
    path: Path

    @property
    def is_placeholder(self) -> bool:
        return _looks_like_placeholder(self.document_id)


def _looks_like_placeholder(value: Any) -> bool:
    """True if ``value`` is not a usable UUID (placeholder text or malformed)."""
    if not isinstance(value, str) or not value.strip():
        return True
    if any(tok in value.upper() for tok in _PLACEHOLDER_TOKENS):
        return True
    try:
        parsed = uuid.UUID(value.strip())
    except (ValueError, AttributeError, TypeError):
        return True
    if parsed == uuid.UUID(int=0):  # nil UUID = fake sentinel
        return True
    return False


def _config_path(doc: str, *, golden_dir: Path = GOLDEN_DIR) -> Path:
    return golden_dir / f"{doc}.config.json"


def _rel(path: Path) -> Path:
    try:
        return path.relative_to(_BACKEND_DIR)
    except ValueError:
        return path


def load_config(doc: str, *, golden_dir: Path = GOLDEN_DIR) -> EvalConfig:
    """Read + validate ``golden/<doc>.config.json``.

    Raises FileNotFoundError, ConfigError, or PlaceholderDocIdError.
    """
    path = _config_path(doc, golden_dir=golden_dir)
    if not path.exists():
        raise FileNotFoundError(f"Missing config: {path}")
    try:
        raw = path.read_text()
    except OSError as exc:  # pragma: no cover - filesystem edge
        raise ConfigError(f"Could not read config {path}: {exc}") from exc
    return validate_config(raw, doc=doc, path=path)


def validate_config(raw: str, *, doc: str, path: Path) -> EvalConfig:
    """Validate a raw JSON string against the config schema."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ConfigError(
            f"{_rel(path)} is not valid JSON (line {exc.lineno} col {exc.colno}): {exc.msg}"
        ) from exc

    if not isinstance(data, dict):
        raise ConfigError(f"{_rel(path)}: expected a JSON object, got {type(data).__name__}.")

    for field in _REQUIRED_FIELDS:
        if field not in data:
            raise ConfigError(
                f"{_rel(path)}: missing required field '{field}'. "
                f"See backend/evals/tuples/README.md for the config schema."
            )

    document_id = data["document_id"]
    if not isinstance(document_id, str):
        raise ConfigError(
            f"{_rel(path)}: 'document_id' must be a string, got {type(document_id).__name__}."
        )

    unknown = set(data) - _KNOWN_FIELDS
    if unknown:
        logger.warning(
            "%s: unknown config field(s) %s — ignored. Known: %s",
            _rel(path), sorted(unknown), sorted(_KNOWN_FIELDS),
        )

    label = data.get("label", doc)
    if not isinstance(label, str):
        raise ConfigError(f"{_rel(path)}: 'label' must be a string, got {type(label).__name__}.")

    notes = data.get("notes", "")
    if not isinstance(notes, str):
        raise ConfigError(f"{_rel(path)}: 'notes' must be a string, got {type(notes).__name__}.")

    top_k = data.get("top_k", DEFAULT_TOP_K)
    if not isinstance(top_k, int) or isinstance(top_k, bool):
        raise ConfigError(f"{_rel(path)}: 'top_k' must be an integer, got {type(top_k).__name__}.")
    if top_k < 1:
        raise ConfigError(f"{_rel(path)}: 'top_k' must be >= 1, got {top_k}.")

    if _looks_like_placeholder(document_id):
        raise PlaceholderDocIdError(
            _placeholder_message(doc=doc, document_id=document_id, path=path)
        )

    return EvalConfig(
        doc=doc,
        document_id=document_id.strip(),
        label=label.strip() or doc,
        top_k=top_k,
        notes=notes,
        path=path,
    )


def _placeholder_message(*, doc: str, document_id: str, path: Path) -> str:
    return (
        f"Config {_rel(path)} still holds a placeholder document_id "
        f"({document_id!r}) for doc '{doc}'.\n"
        f"To fix:\n"
        f"  1. Upload the {doc} PDF to your DEV environment and wait for status=ready.\n"
        f"  2. Copy the real documents.id UUID from Supabase (Table editor -> documents -> id).\n"
        f"  3. Paste that UUID into the 'document_id' field of {_rel(path)}.\n"
        f"  4. Re-run: python -m evals.run_ragas --doc {doc} --limit 5\n"
        f"Until then this doc cannot be evaluated against live retrieval. "
        f"See backend/evals/tuples/README.md."
    )
