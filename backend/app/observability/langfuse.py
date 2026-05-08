"""Langfuse client singleton and FastAPI lifespan helpers.

Implements the client-init module described in
``docs/specs/langfuse-selfhost.md`` §5 ("Backend integration plan"). The
module owns one process-wide Langfuse v4 client (or ``None`` when the
NOOP path is taken) and exposes :func:`flush` and :func:`is_enabled` for
the FastAPI lifespan to call.

NOOP path
---------
If any of ``LANGFUSE_PUBLIC_KEY``, ``LANGFUSE_SECRET_KEY``, or
``LANGFUSE_HOST`` is empty in :mod:`app.config`, the module logs once at
INFO level and ``langfuse`` stays ``None``. Call sites can keep the
``@observe()`` decorator applied — when no client has been initialized
the decorator is a documented no-op (see Langfuse v4 docs).

Environment tag
---------------
The v4 SDK reads the trace environment from the
``LANGFUSE_TRACING_ENVIRONMENT`` env var (verified in
``langfuse/_client/environment_variables.py:7`` of the installed
``langfuse==4.6.1``). We set that variable from
``settings.langfuse_environment`` (default ``"development"``) before
constructing the client. The constructor's ``environment`` kwarg is also
passed for redundancy.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from langfuse import Langfuse, get_client, observe  # noqa: F401  (re-export observe)

from app.config import get_settings

__all__ = ["observe", "flush", "is_enabled", "langfuse"]

logger = logging.getLogger(__name__)

# Module-level singleton. ``None`` when the NOOP path is taken.
langfuse: Optional[Langfuse] = None


def _coerced_str(value, default: str = "") -> str:
    """Return ``value`` if it is a non-empty ``str``; otherwise ``default``.

    Defensive: a couple of pre-existing test files replace
    ``app.config.get_settings`` with a lambda returning a ``MagicMock``,
    so attribute access yields fresh ``MagicMock`` objects (truthy, not
    strings). Treat those as "missing" and stay on the NOOP path.
    """
    return value if isinstance(value, str) and value else default


def _missing_credential(settings) -> Optional[str]:
    """Return the name of the first missing credential, or ``None``."""
    if not _coerced_str(getattr(settings, "langfuse_public_key", "")):
        return "LANGFUSE_PUBLIC_KEY"
    if not _coerced_str(getattr(settings, "langfuse_secret_key", "")):
        return "LANGFUSE_SECRET_KEY"
    if not _coerced_str(getattr(settings, "langfuse_host", "")):
        return "LANGFUSE_HOST"
    return None


def _init_client() -> Optional[Langfuse]:
    """Build the Langfuse singleton from settings, or return ``None``.

    Idempotent: callers should assign the result to the module-level
    ``langfuse`` global. The NOOP path logs exactly once per process.
    """
    settings = get_settings()
    missing = _missing_credential(settings)
    if missing is not None:
        logger.info(
            "Langfuse disabled: %s missing — instrumentation will be a no-op",
            missing,
        )
        return None

    public_key = _coerced_str(settings.langfuse_public_key)
    secret_key = _coerced_str(settings.langfuse_secret_key)
    host = _coerced_str(settings.langfuse_host)
    environment = _coerced_str(
        getattr(settings, "langfuse_environment", "development"), "development"
    )

    # The v4 SDK auto-reads these env vars during client construction.
    # Setting them explicitly here keeps the behaviour deterministic
    # regardless of how settings are loaded (.env vs Railway runtime).
    os.environ["LANGFUSE_PUBLIC_KEY"] = public_key
    os.environ["LANGFUSE_SECRET_KEY"] = secret_key
    os.environ["LANGFUSE_HOST"] = host
    os.environ["LANGFUSE_TRACING_ENVIRONMENT"] = environment

    release = os.environ.get("RAILWAY_GIT_COMMIT_SHA")
    if release:
        os.environ.setdefault("LANGFUSE_RELEASE", release)

    # Construct via the constructor so we can pass environment+release
    # explicitly (defence in depth in case the env-var read path changes
    # in a future SDK release). ``get_client()`` returns the singleton
    # afterwards.
    Langfuse(
        public_key=public_key,
        secret_key=secret_key,
        host=host,
        environment=environment,
        release=release,
    )
    return get_client()


def is_enabled() -> bool:
    """Return ``True`` when the Langfuse singleton is live."""
    return langfuse is not None


def flush() -> None:
    """Flush buffered events. No-op when the client is disabled."""
    if langfuse is None:
        return
    try:
        langfuse.flush()
    except Exception:  # pragma: no cover — SDK swallows internally
        # Per spec §5 "Failure mode": Langfuse must not break the app.
        logger.exception("Langfuse flush failed; continuing shutdown")


def _reset_for_tests() -> None:
    """Re-run client init using current settings/env. Test-only helper.

    ``app.config.get_settings`` is ``@lru_cache``-d, so production callers
    do not benefit from re-init. Tests that monkeypatch settings call
    ``get_settings.cache_clear()`` themselves and then invoke this helper
    to rebuild the singleton.
    """
    global langfuse
    langfuse = _init_client()


# Initialise on import so the rest of the app can rely on
# ``is_enabled()`` immediately.
langfuse = _init_client()
