"""Unit tests for evals.config — schema validation + placeholder guard.

All fixtures/data here are SYNTHETIC and test-only; none are real golden data.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

from evals.config import (
    DEFAULT_TOP_K,
    ConfigError,
    EvalConfig,
    PlaceholderDocIdError,
    load_config,
    validate_config,
)

VALID_UUID = "12345678-1234-1234-1234-123456789abc"


def _path(name: str = "sample.config.json") -> Path:
    return Path(name)


# --- validate_config: happy path ---

def test_valid_config_parses():
    cfg = validate_config(
        json.dumps({"document_id": VALID_UUID, "label": "Doc", "top_k": 7}),
        doc="ddia", path=_path(),
    )
    assert isinstance(cfg, EvalConfig)
    assert cfg.document_id == VALID_UUID
    assert cfg.label == "Doc"
    assert cfg.top_k == 7
    assert cfg.is_placeholder is False


def test_valid_config_defaults_top_k_and_label():
    cfg = validate_config(json.dumps({"document_id": VALID_UUID}), doc="ddia", path=_path())
    assert cfg.top_k == DEFAULT_TOP_K
    assert cfg.label == "ddia"  # falls back to slug


# --- validate_config: placeholder guard (headline behavior) ---

@pytest.mark.parametrize("doc_id", [
    "REPLACE_WITH_DDIA_DOCUMENT_UUID_FROM_SUPABASE",
    "PLACEHOLDER",
    "TODO: fill me",
    "your-uuid-here",
    "not-a-uuid",
    "00000000-0000-0000-0000-000000000000",  # nil UUID = fake sentinel
    "",
    "  ",
])
def test_placeholder_or_invalid_doc_id_raises(doc_id):
    with pytest.raises(PlaceholderDocIdError) as exc:
        validate_config(json.dumps({"document_id": doc_id}),
                        doc="ddia", path=Path("evals/golden/ddia.config.json"))
    msg = str(exc.value)
    assert "placeholder" in msg.lower() or "document_id" in msg
    assert "Supabase" in msg or "documents.id" in msg
    assert "ddia" in msg


def test_placeholder_message_names_the_config_file():
    with pytest.raises(PlaceholderDocIdError) as exc:
        validate_config(json.dumps({"document_id": "REPLACE_WITH_X"}),
                        doc="ddia", path=Path("evals/golden/ddia.config.json"))
    assert "evals/golden/ddia.config.json" in str(exc.value)


# --- validate_config: structural errors ---

def test_bad_json_raises_config_error():
    with pytest.raises(ConfigError) as exc:
        validate_config("{not json", doc="ddia", path=_path())
    assert "valid JSON" in str(exc.value)


def test_non_object_raises_config_error():
    with pytest.raises(ConfigError):
        validate_config('["a", "b"]', doc="ddia", path=_path())


def test_missing_document_id_raises_config_error():
    with pytest.raises(ConfigError) as exc:
        validate_config(json.dumps({"label": "x"}), doc="ddia", path=_path())
    assert "document_id" in str(exc.value)


def test_non_string_document_id_raises_config_error():
    with pytest.raises(ConfigError):
        validate_config(json.dumps({"document_id": 123}), doc="ddia", path=_path())


def test_bad_top_k_type_raises_config_error():
    with pytest.raises(ConfigError):
        validate_config(json.dumps({"document_id": VALID_UUID, "top_k": "5"}),
                        doc="ddia", path=_path())


def test_top_k_below_one_raises_config_error():
    with pytest.raises(ConfigError):
        validate_config(json.dumps({"document_id": VALID_UUID, "top_k": 0}),
                        doc="ddia", path=_path())


def test_bool_top_k_rejected():
    # bool is a subclass of int; guard against it.
    with pytest.raises(ConfigError):
        validate_config(json.dumps({"document_id": VALID_UUID, "top_k": True}),
                        doc="ddia", path=_path())


def test_unknown_field_warns_not_fails(caplog):
    with caplog.at_level(logging.WARNING):
        cfg = validate_config(json.dumps({"document_id": VALID_UUID, "surprise": "x"}),
                              doc="ddia", path=_path())
    assert cfg.document_id == VALID_UUID
    assert any("surprise" in r.message for r in caplog.records)


# --- load_config: file integration ---

def test_load_config_valid(fixtures_dir: Path):
    cfg = load_config("ddia_valid", golden_dir=fixtures_dir)
    assert cfg.document_id == VALID_UUID
    assert cfg.top_k == 3


def test_load_config_placeholder(fixtures_dir: Path):
    with pytest.raises(PlaceholderDocIdError):
        load_config("ddia_placeholder", golden_dir=fixtures_dir)


def test_load_config_missing_file(fixtures_dir: Path):
    with pytest.raises(FileNotFoundError):
        load_config("does_not_exist", golden_dir=fixtures_dir)


def test_load_config_bad_json(fixtures_dir: Path):
    with pytest.raises(ConfigError):
        load_config("ddia_badjson", golden_dir=fixtures_dir)


def test_load_config_missing_field(fixtures_dir: Path):
    with pytest.raises(ConfigError) as exc:
        load_config("ddia_missing_field", golden_dir=fixtures_dir)
    assert "document_id" in str(exc.value)
