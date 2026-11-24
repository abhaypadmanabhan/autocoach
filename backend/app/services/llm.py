"""LLM service: primary model (OpenRouter, or Kimi direct) with OpenAI fallback."""

import json
import logging
import time
from typing import Optional

from openai import OpenAI
from langfuse import get_client

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Kimi API configuration
KIMI_BASE_URL = "https://api.moonshot.ai/v1"
KIMI_MODEL = "kimi-k2.6"

# OpenRouter (OpenAI-compatible). Used as the primary LLM whenever
# OPENROUTER_API_KEY is set; the model id comes from OPENROUTER_MODEL.
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class LLMText(str):
    """LLM response text that also carries `model`/`usage_details` for
    Langfuse generation tagging (#72). Still a plain `str` (via `__new__`)
    so existing callers that only care about the text — e.g. concepts.py's
    `call_kimi(...).strip()` — are unaffected."""

    model: Optional[str]
    usage_details: Optional[dict]

    def __new__(
        cls,
        text: str,
        *,
        model: Optional[str] = None,
        usage_details: Optional[dict] = None,
    ) -> "LLMText":
        obj = super().__new__(cls, text)
        obj.model = model
        obj.usage_details = usage_details
        return obj


def _usage_details(usage) -> Optional[dict]:
    """Map an OpenAI-SDK `CompletionUsage` to Langfuse's generic usage_details
    shape. Returns None when the API response carries no usage block."""
    if usage is None:
        return None
    return {
        "input": usage.prompt_tokens,
        "output": usage.completion_tokens,
        "total": usage.total_tokens,
    }


def tag_current_generation(response: str) -> None:
    """Attach `model` + `usage_details` from an `LLMText` onto the current
    Langfuse generation span (#72). No-op for plain strings — covers the
    empty-response failure path and test doubles that stub call_kimi/call_openai
    with bare strings."""
    model = getattr(response, "model", None)
    if model is None:
        return
    try:
        get_client().update_current_generation(
            model=model, usage_details=getattr(response, "usage_details", None)
        )
    except Exception as e:
        # Observability must never break a successful LLM call — fail open.
        logger.warning(f"Langfuse generation tagging failed: {e}")


def mark_current_observation_error(status_message: str) -> None:
    """Flag the current Langfuse observation as failed (#73).

    Both LLM callers swallow their exception and return `""` so the request
    path stays up — which also made every failure invisible in the Langfuse
    UI. `update_current_span` writes the generic observation attributes, so
    it applies to generation spans too. Fails open like the tagging helper."""
    try:
        get_client().update_current_span(
            level="ERROR", status_message=status_message[:500]
        )
    except Exception as e:
        # Observability must never break the request path — fail open.
        logger.warning(f"Langfuse error tagging failed: {e}")


# List prices (USD per million tokens) for models called directly, used only
# by the spend ledger. OpenRouter calls are priced at the routing ceiling.
_DIRECT_LIST_PRICE = {"gpt-4o-mini": (0.15, 0.60)}


class SpendCapReached(RuntimeError):
    """The spend ledger total has reached `llm_spend_cap_usd`."""


def _ledger_path() -> str:
    return getattr(settings, "llm_spend_ledger_path", "") or ""


def spend_total(path: Optional[str] = None) -> float:
    """Sum of `cost_usd` over the spend ledger; 0.0 when there is none."""
    path = path or _ledger_path()
    if not path:
        return 0.0
    total = 0.0
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    total += float(json.loads(line).get("cost_usd") or 0.0)
    except FileNotFoundError:
        return 0.0
    return total


def _check_spend_cap() -> None:
    cap = float(getattr(settings, "llm_spend_cap_usd", 0.0) or 0.0)
    if not _ledger_path() or cap <= 0:
        return
    total = spend_total()
    if total >= cap:
        raise SpendCapReached(f"LLM spend ${total:.4f} has reached the ${cap:.2f} cap")


def _record_spend(label: str, model: str, usage, price: Optional[tuple]) -> None:
    """Append one call to the spend ledger. `price` is (prompt, completion) in
    USD per million tokens; the charged cost the API reports wins when higher.
    Never raises: bookkeeping must not break a successful call."""
    path = _ledger_path()
    if not path or usage is None:
        return
    try:
        prompt = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion = int(getattr(usage, "completion_tokens", 0) or 0)
        estimate = (prompt * price[0] + completion * price[1]) / 1e6 if price else 0.0
        reported = getattr(usage, "cost", None)
        reported = float(reported) if isinstance(reported, (int, float)) else None
        entry = {
            "ts": time.time(),
            "backend": label,
            "model": model,
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "cost_usd": max(estimate, reported or 0.0),
            "reported_cost_usd": reported,
            "priced": price is not None,
        }
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry) + "\n")
    except Exception as e:
        logger.warning(f"Spend ledger write failed: {e}")


def _primary_llm() -> dict:
    """Pick the primary LLM backend: OpenRouter when its key is set, else Kimi direct.

    `extra_body` is provider-specific: Moonshot takes `thinking`, OpenRouter takes
    a unified `reasoning` switch. Both suppress reasoning output for fast replies.
    OpenRouter also gets a provider price ceiling (`max_price`, USD per million
    tokens): it will not route a request to an endpoint priced above it."""
    if settings.openrouter_api_key:
        price = (
            settings.openrouter_max_price_prompt,
            settings.openrouter_max_price_completion,
        )
        return {
            "label": "OpenRouter",
            "api_key": settings.openrouter_api_key,
            "base_url": OPENROUTER_BASE_URL,
            "model": settings.openrouter_model,
            "extra_body": {
                "reasoning": {"enabled": False},
                "provider": {"max_price": {"prompt": price[0], "completion": price[1]}},
            },
            "price": price,
            "tunable": True,
        }
    return {
        "label": "Kimi",
        "api_key": settings.kimi_api_key,
        "base_url": KIMI_BASE_URL,
        "model": KIMI_MODEL,
        "extra_body": {"thinking": {"type": "disabled"}},
        "price": None,
        "tunable": False,
    }


def call_kimi(
    system_prompt: str,
    user_prompt: str,
    *,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    response_format: Optional[dict] = None,
    max_tokens: int = 4096,
) -> str:
    """
    Call the primary LLM (OpenRouter if configured, else Kimi direct).

    The name is historical: every caller and test patches `call_kimi`, so it
    keeps its name while the backend is chosen by `_primary_llm()`.
    Reasoning is disabled for faster responses.

    Args:
        system_prompt: The system prompt defining the AI's behavior.
        user_prompt: The user prompt with the specific request.
        model: OpenRouter model id overriding `OPENROUTER_MODEL` for this call
            (a verifier or judge from a different family). Ignored on Kimi direct.
        temperature: Sampling temperature. Ignored on Kimi direct, where
            Moonshot rejects anything but its default.
        response_format: OpenAI-style `response_format` (JSON object or schema).
        max_tokens: Completion cap.

    Returns:
        The generated response text, or empty string on failure.
    """
    label = "Kimi"
    try:
        cfg = _primary_llm()
        label = cfg["label"]
        model = (model if cfg["tunable"] else None) or cfg["model"]
        _check_spend_cap()
        client = OpenAI(api_key=cfg["api_key"], base_url=cfg["base_url"])

        optional = {}
        if temperature is not None and cfg["tunable"]:
            optional["temperature"] = temperature
        if response_format is not None:
            optional["response_format"] = response_format

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=max_tokens,
            extra_body=cfg["extra_body"],
            **optional,
        )

        content = response.choices[0].message.content
        _record_spend(label, response.model or model, response.usage, cfg["price"])
        if response.model and not response.model.startswith(model):
            logger.warning(f"{label} response model={response.model}, expected {model}")
        logger.info(f"{label} API call successful, response length: {len(content) if content else 0}")
        return LLMText(
            content or "",
            model=response.model or model,
            usage_details=_usage_details(response.usage),
        )
    except Exception as e:
        logger.error(f"{label} API call failed: {e}")
        mark_current_observation_error(f"{label} API call failed: {e}")
        return ""


def call_openai(
    system_prompt: str,
    user_prompt: str,
    model: str = "gpt-4o-mini",
    temperature: float = 0.7
) -> str:
    """
    Call the OpenAI API to generate a response (fallback).

    Args:
        system_prompt: The system prompt defining the AI's behavior.
        user_prompt: The user prompt with the specific request.
        model: The OpenAI model to use.
        temperature: Sampling temperature (0.0 to 1.0).

    Returns:
        The generated response text, or empty string on failure.
    """
    try:
        _check_spend_cap()
        client = OpenAI(api_key=settings.openai_api_key)

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=temperature
        )

        content = response.choices[0].message.content
        _record_spend("OpenAI", model, response.usage, _DIRECT_LIST_PRICE.get(model))
        logger.info(f"OpenAI API call successful, response length: {len(content) if content else 0}")
        return LLMText(
            content or "",
            model=response.model or model,
            usage_details=_usage_details(response.usage),
        )
    except Exception as e:
        logger.error(f"OpenAI API call failed: {e}")
        mark_current_observation_error(f"OpenAI API call failed: {e}")
        return ""
