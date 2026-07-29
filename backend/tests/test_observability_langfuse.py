"""Tests for app.observability.langfuse (Phase 1.7 task 1).

Covers the client-init module: NOOP-when-keys-missing, enabled
construction, safe flush, and propagation of the ``environment`` /
``release`` kwargs to the Langfuse v4 constructor. We patch the
Langfuse SDK to avoid opening any real network connections.
"""

from __future__ import annotations

import ast
import os
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

if "langfuse" not in sys.modules:
    langfuse_stub = types.ModuleType("langfuse")
    langfuse_stub.Langfuse = MagicMock(name="Langfuse")
    langfuse_stub.get_client = MagicMock(name="get_client")
    langfuse_stub.observe = lambda *args, **kwargs: (
        (lambda fn: fn) if not args else args[0]
    )
    sys.modules["langfuse"] = langfuse_stub

from app.config import Settings
from app.observability import langfuse as obs


BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def _restore_module_state(monkeypatch):
    """Snapshot/restore module state and Langfuse env vars per test.

    The implementation no longer writes to ``os.environ`` at init time,
    but we still snapshot/restore the Langfuse-related env vars so that
    inherited values from the developer shell can't perturb test runs
    (e.g. ``RAILWAY_GIT_COMMIT_SHA`` flowing into the ``release`` kwarg).
    """
    saved_client = obs.langfuse
    saved_env = {
        k: os.environ.get(k)
        for k in (
            "LANGFUSE_PUBLIC_KEY",
            "LANGFUSE_SECRET_KEY",
            "LANGFUSE_HOST",
            "LANGFUSE_TRACING_ENVIRONMENT",
            "LANGFUSE_RELEASE",
            "RAILWAY_GIT_COMMIT_SHA",
        )
    }
    # Drop any inherited values so each test starts from a clean slate.
    for k in saved_env:
        monkeypatch.delenv(k, raising=False)
    yield
    obs.langfuse = saved_client
    for k, v in saved_env.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v


def _settings(**overrides) -> Settings:
    base = {
        "qdrant_url": "http://localhost",
        "qdrant_api_key": "x",
        "kimi_api_key": "x",
        "langfuse_public_key": "",
        "langfuse_secret_key": "",
        "langfuse_host": "",
        "langfuse_environment": "development",
    }
    base.update(overrides)
    return Settings(**base)


def _observe_kwargs(module_path: str, function_name: str) -> dict[str, object]:
    source = (BACKEND_DIR / module_path).read_text()
    tree = ast.parse(source)

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name != function_name:
                continue

            for decorator in node.decorator_list:
                if not isinstance(decorator, ast.Call):
                    continue
                if not isinstance(decorator.func, ast.Name):
                    continue
                if decorator.func.id != "observe":
                    continue
                return {
                    keyword.arg: ast.literal_eval(keyword.value)
                    for keyword in decorator.keywords
                    if keyword.arg is not None
                }

    raise AssertionError(f"Missing @observe decorator on {module_path}:{function_name}")


@pytest.mark.parametrize(
    ("module_path", "function_name"),
    [
        ("app/services/concepts.py", "extract_concepts"),
        ("app/services/embeddings.py", "get_embeddings"),
        ("app/services/retrieval.py", "retrieve_relevant_chunks"),
        ("app/services/text_extraction.py", "extract_text_from_pdf"),
        ("app/services/text_extraction.py", "extract_text_from_pptx"),
        ("app/services/ingestion.py", "_extract_document_text"),
        ("app/services/ingestion.py", "_chunk_document_text"),
        ("app/services/ingestion.py", "_embed_chunks"),
        ("app/services/ingestion.py", "_upsert_vectors"),
    ],
)
def test_payload_risky_observe_spans_disable_capture(module_path, function_name):
    kwargs = _observe_kwargs(module_path, function_name)

    assert kwargs.get("capture_input") is False
    assert kwargs.get("capture_output") is False


# ---------------------------------------------------------------------------
# NOOP path: each missing credential disables the client.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "missing_field",
    ["langfuse_public_key", "langfuse_secret_key", "langfuse_host"],
)
def test_is_enabled_false_when_credential_missing(missing_field):
    creds = {
        "langfuse_public_key": "pk-test",
        "langfuse_secret_key": "sk-test",
        "langfuse_host": "http://langfuse.example",
    }
    creds[missing_field] = ""
    settings = _settings(**creds)

    with patch("app.observability.langfuse.get_settings", return_value=settings):
        with patch("app.observability.langfuse.Langfuse") as mock_ctor:
            obs._reset_for_tests()
            assert obs.is_enabled() is False
            assert obs.langfuse is None
            mock_ctor.assert_not_called()


# ---------------------------------------------------------------------------
# Enabled path.
# ---------------------------------------------------------------------------


def test_is_enabled_true_when_all_credentials_present():
    settings = _settings(
        langfuse_public_key="pk-test",
        langfuse_secret_key="sk-test",
        langfuse_host="http://langfuse.example",
        langfuse_environment="development",
    )
    fake_client = MagicMock(name="LangfuseClient")

    with patch("app.observability.langfuse.get_settings", return_value=settings):
        with patch("app.observability.langfuse.Langfuse") as mock_ctor:
            with patch(
                "app.observability.langfuse.get_client", return_value=fake_client
            ):
                obs._reset_for_tests()
                assert obs.is_enabled() is True
                assert obs.langfuse is fake_client
                mock_ctor.assert_called_once()
                kwargs = mock_ctor.call_args.kwargs
                assert kwargs["public_key"] == "pk-test"
                assert kwargs["secret_key"] == "sk-test"
                assert kwargs["host"] == "http://langfuse.example"


# ---------------------------------------------------------------------------
# flush() behaviour.
# ---------------------------------------------------------------------------


def test_flush_is_safe_when_disabled():
    settings = _settings()  # all empty
    with patch("app.observability.langfuse.get_settings", return_value=settings):
        obs._reset_for_tests()
        assert obs.langfuse is None
        # Must not raise.
        obs.flush()


def test_flush_calls_underlying_client_when_enabled():
    settings = _settings(
        langfuse_public_key="pk-test",
        langfuse_secret_key="sk-test",
        langfuse_host="http://langfuse.example",
    )
    fake_client = MagicMock(name="LangfuseClient")
    with patch("app.observability.langfuse.get_settings", return_value=settings):
        with patch("app.observability.langfuse.Langfuse"):
            with patch(
                "app.observability.langfuse.get_client", return_value=fake_client
            ):
                obs._reset_for_tests()
                obs.flush()
                fake_client.flush.assert_called_once()


# ---------------------------------------------------------------------------
# Environment-tag propagation via constructor kwargs.
# ---------------------------------------------------------------------------


def test_environment_defaults_to_development():
    settings = _settings(
        langfuse_public_key="pk-test",
        langfuse_secret_key="sk-test",
        langfuse_host="http://langfuse.example",
    )
    with patch("app.observability.langfuse.get_settings", return_value=settings):
        with patch("app.observability.langfuse.Langfuse") as mock_ctor:
            with patch(
                "app.observability.langfuse.get_client", return_value=MagicMock()
            ):
                obs._reset_for_tests()
                kwargs = mock_ctor.call_args.kwargs
                assert kwargs["environment"] == "development"


def test_environment_propagates_configured_value():
    settings = _settings(
        langfuse_public_key="pk-test",
        langfuse_secret_key="sk-test",
        langfuse_host="http://langfuse.example",
        langfuse_environment="production",
    )
    with patch("app.observability.langfuse.get_settings", return_value=settings):
        with patch("app.observability.langfuse.Langfuse") as mock_ctor:
            with patch(
                "app.observability.langfuse.get_client", return_value=MagicMock()
            ):
                obs._reset_for_tests()
                kwargs = mock_ctor.call_args.kwargs
                assert kwargs["environment"] == "production"


def test_release_passed_from_railway_commit_sha(monkeypatch):
    """``release`` kwarg is sourced from RAILWAY_GIT_COMMIT_SHA when set."""
    settings = _settings(
        langfuse_public_key="pk-test",
        langfuse_secret_key="sk-test",
        langfuse_host="http://langfuse.example",
    )
    monkeypatch.setenv("RAILWAY_GIT_COMMIT_SHA", "abc123")
    with patch("app.observability.langfuse.get_settings", return_value=settings):
        with patch("app.observability.langfuse.Langfuse") as mock_ctor:
            with patch(
                "app.observability.langfuse.get_client", return_value=MagicMock()
            ):
                obs._reset_for_tests()
                kwargs = mock_ctor.call_args.kwargs
                assert kwargs["release"] == "abc123"


# ---------------------------------------------------------------------------
# Failure mode: constructor exceptions must not propagate.
# ---------------------------------------------------------------------------


def test_constructor_exception_disables_client_without_propagating(caplog):
    """If the SDK constructor raises, init must swallow and disable."""
    settings = _settings(
        langfuse_public_key="pk-test",
        langfuse_secret_key="sk-test",
        langfuse_host="http://langfuse.example",
    )

    def _boom(*_args, **_kwargs):
        raise RuntimeError("boom")

    with patch("app.observability.langfuse.get_settings", return_value=settings):
        with patch("app.observability.langfuse.Langfuse", side_effect=_boom):
            # Must not raise.
            obs._reset_for_tests()
            assert obs.is_enabled() is False
            assert obs.langfuse is None


def test_init_diagnostics_do_not_print_raw_host_or_exception(caplog):
    """Init diagnostics must avoid leaking host or exception payloads."""
    settings = _settings(
        langfuse_public_key="pk-test",
        langfuse_secret_key="sk-test",
        langfuse_host="https://private.langfuse.example/path",
    )

    def _boom(*_args, **_kwargs):
        raise RuntimeError("secret constructor payload")

    with patch("app.observability.langfuse.get_settings", return_value=settings):
        with patch("app.observability.langfuse.Langfuse", side_effect=_boom):
            with patch("builtins.print") as mock_print:
                obs._reset_for_tests()

    printed = "\n".join(
        " ".join(str(part) for part in call.args) for call in mock_print.call_args_list
    )
    logs = "\n".join(record.message for record in caplog.records)

    assert "private.langfuse.example" not in printed
    assert "secret constructor payload" not in printed
    assert "private.langfuse.example" not in logs
    assert "secret constructor payload" not in logs
