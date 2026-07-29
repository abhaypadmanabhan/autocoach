"""Langfuse client singleton and FastAPI lifespan helpers.

The module owns one process-wide Langfuse v4 client (or ``None`` when the
NOOP path is taken) and exposes :func:`flush` and :func:`is_enabled` for
the FastAPI lifespan to call. Backend runs against Langfuse Cloud.

Failure mode
------------
Observability must never break the request path or application startup.
Every entry point here — construction, scoring, flush — swallows its own
exceptions and degrades to a no-op.

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
``"development"``) feeds the ``environment`` kwarg. ``sample_rate`` is
threaded the same way from ``settings.langfuse_sample_rate``.
"""

from __future__ import annotations

import logging
import os
from typing import Literal, Optional

from langfuse import Langfuse, get_client, observe  # noqa: F401  (re-export observe)

from app.config import Settings, get_settings

__all__ = [
    "observe",
    "flush",
    "is_enabled",
    "langfuse",
    "score_current_trace",
]

ScoreDataType = Literal["NUMERIC", "CATEGORICAL", "BOOLEAN", "TEXT"]

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


def _resolve_sample_rate(settings: Settings) -> float:
    """Return a constructor-safe ``sample_rate`` from settings.

    The v4 constructor raises ``ValueError`` outside ``[0.0, 1.0]`` and
    :func:`_init_client` swallows constructor exceptions — so a typo'd
    ``LANGFUSE_SAMPLE_RATE`` would silently disable *all* tracing rather
    than just mis-sampling. Fall back to 1.0 and say so in the log.
    """
    raw = getattr(settings, "langfuse_sample_rate", 1.0)
    try:
        rate = float(raw)
    except (TypeError, ValueError):
        logger.warning("LANGFUSE_SAMPLE_RATE is not a number; falling back to 1.0")
        return 1.0
    if not 0.0 <= rate <= 1.0:
        logger.warning(
            "LANGFUSE_SAMPLE_RATE=%s outside [0.0, 1.0]; falling back to 1.0", rate
        )
        return 1.0
    return rate


def _init_client() -> Optional[Langfuse]:
    """Build the Langfuse singleton from settings, or return ``None``.

    Idempotent: callers should assign the result to the module-level
    ``langfuse`` global. The NOOP path logs exactly once per process.
    Any exception raised by the SDK constructor is swallowed — see this
    module's "Failure mode" note.
    """
    settings = get_settings()
    pub = getattr(settings, "langfuse_public_key", "") or ""
    sec = getattr(settings, "langfuse_secret_key", "") or ""
    host = getattr(settings, "langfuse_host", "") or ""
    logger.info(
        "Langfuse init config: pub_len=%d sec_len=%d host_set=%s",
        len(pub),
        len(sec),
        bool(host),
    )
    missing = _missing_credential(settings)
    if missing is not None:
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
    sample_rate = _resolve_sample_rate(settings)

    try:
        Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            host=host,
            environment=environment,
            release=release,
            sample_rate=sample_rate,
        )
        client = get_client()
        logger.info(
            "Langfuse client constructed: environment=%s host_set=%s sample_rate=%s",
            environment,
            bool(host),
            sample_rate,
        )
        return client
    except Exception as exc:  # pragma: no cover — diagnostic
        logger.warning(
            "Langfuse client init failed; instrumentation disabled (%s)",
            type(exc).__name__,
        )
        return None


def is_enabled() -> bool:
    """Return ``True`` when the Langfuse singleton is live."""
    return langfuse is not None


def score_current_trace(
    name: str,
    value: float | str,
    *,
    data_type: ScoreDataType = "NUMERIC",
    comment: Optional[str] = None,
) -> None:
    """Attach a score to the trace currently in context.

    No-op when the client is disabled (NOOP path) and never raises: a
    missing active span, a transport hiccup or an SDK change must not turn
    a graded answer into a 500. Used for live-traffic quality signals —
    offline eval scores come from ``backend/evals`` instead.
    """
    if langfuse is None:
        return
    try:
        langfuse.score_current_trace(
            name=name, value=value, data_type=data_type, comment=comment
        )
    except Exception as exc:
        logger.warning(
            "Langfuse score %r failed (%s); continuing", name, type(exc).__name__
        )


def flush() -> None:
    """Flush buffered events. No-op when the client is disabled."""
    if langfuse is None:
        return
    try:
        langfuse.flush()
    except Exception:  # pragma: no cover — SDK swallows internally
        # Failure mode: Langfuse must not break the app.
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
