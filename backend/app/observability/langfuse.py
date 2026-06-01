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
The v4 ``Langfuse(...)`` constructor accepts ``environment`` and
``release`` directly, so we pass them as kwargs and avoid mutating the
process environment. ``settings.langfuse_environment`` (default
``"development"``) feeds the ``environment`` kwarg.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from langfuse import Langfuse, get_client, observe  # noqa: F401  (re-export observe)

from app.config import Settings, get_settings

__all__ = ["observe", "flush", "is_enabled", "langfuse"]

logger = logging.getLogger(__name__)

# Module-level singleton. ``None`` when the NOOP path is taken.
langfuse: Optional[Langfuse] = None


def _missing_credential(settings: Settings) -> Optional[str]:
    """Return the name of the first missing credential, or ``None``."""
    if not (getattr(settings, "langfuse_public_key", "") or ""):
        return "LANGFUSE_PUBLIC_KEY"
    if not (getattr(settings, "langfuse_secret_key", "") or ""):
        return "LANGFUSE_SECRET_KEY"
    if not (getattr(settings, "langfuse_host", "") or ""):
        return "LANGFUSE_HOST"
    return None


def _init_client() -> Optional[Langfuse]:
    """Build the Langfuse singleton from settings, or return ``None``.

    Idempotent: callers should assign the result to the module-level
    ``langfuse`` global. The NOOP path logs exactly once per process.
    Any exception raised by the SDK constructor is swallowed — per spec
    §5 "Failure mode", Langfuse must never break the request path or
    application startup.
    """
    settings = get_settings()
    # TEMP DIAGNOSTIC (2026-06-01): logging at module import time has
    # historically been swallowed even with basicConfig(force=True) hoisted
    # above app imports. Print to stdout so we can see WHY init goes NOOP
    # in Railway logs. Prints lengths only (never full keys). Remove once
    # we confirm Langfuse Cloud connectivity.
    pub = getattr(settings, "langfuse_public_key", "") or ""
    sec = getattr(settings, "langfuse_secret_key", "") or ""
    host = getattr(settings, "langfuse_host", "") or ""
    print(
        f"[langfuse-init] pub_len={len(pub)} sec_len={len(sec)} "
        f"host={host!r}",
        flush=True,
    )
    missing = _missing_credential(settings)
    if missing is not None:
        msg = f"[langfuse-init] disabled — {missing} empty"
        print(msg, flush=True)
        logger.info(
            "Langfuse disabled: %s missing — instrumentation will be a no-op",
            missing,
        )
        return None

    public_key = getattr(settings, "langfuse_public_key", "") or ""
    secret_key = getattr(settings, "langfuse_secret_key", "") or ""
    host = getattr(settings, "langfuse_host", "") or ""
    environment = (
        getattr(settings, "langfuse_environment", "development") or "development"
    )
    release = os.environ.get("RAILWAY_GIT_COMMIT_SHA") or None

    try:
        Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            host=host,
            environment=environment,
            release=release,
        )
        client = get_client()
        print(
            f"[langfuse-init] client constructed ok host={host!r} "
            f"environment={environment!r}",
            flush=True,
        )
        return client
    except Exception as exc:  # pragma: no cover — diagnostic
        print(f"[langfuse-init] constructor raised: {exc!r}", flush=True)
        logger.exception(
            "Langfuse client init failed; instrumentation disabled"
        )
        return None


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
