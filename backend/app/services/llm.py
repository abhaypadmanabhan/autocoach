"""LLM service for calling Kimi and OpenAI APIs."""

import logging
from typing import Optional

from openai import OpenAI
from langfuse import get_client

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Kimi API configuration
KIMI_BASE_URL = "https://api.moonshot.ai/v1"
KIMI_MODEL = "kimi-k2.6"


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
    get_client().update_current_generation(
        model=model, usage_details=getattr(response, "usage_details", None)
    )


def call_kimi(system_prompt: str, user_prompt: str) -> str:
    """
    Call the Kimi API to generate a response using Instant Mode.

    Instant Mode provides faster responses without reasoning traces.

    Args:
        system_prompt: The system prompt defining the AI's behavior.
        user_prompt: The user prompt with the specific request.

    Returns:
        The generated response text, or empty string on failure.
    """
    try:
        client = OpenAI(
            api_key=settings.kimi_api_key,
            base_url=KIMI_BASE_URL
        )

        # Use Instant Mode: disable thinking for faster responses (official API format)
        response = client.chat.completions.create(
            model=KIMI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=4096,
            extra_body={"thinking": {"type": "disabled"}}
        )

        content = response.choices[0].message.content
        if response.model and not response.model.startswith(KIMI_MODEL):
            logger.warning(f"Kimi response model={response.model}, expected {KIMI_MODEL}")
        logger.info(f"Kimi API call successful, response length: {len(content) if content else 0}")
        return LLMText(
            content or "",
            model=response.model or KIMI_MODEL,
            usage_details=_usage_details(response.usage),
        )
    except Exception as e:
        logger.error(f"Kimi API call failed: {e}")
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
        logger.info(f"OpenAI API call successful, response length: {len(content) if content else 0}")
        return LLMText(
            content or "",
            model=response.model or model,
            usage_details=_usage_details(response.usage),
        )
    except Exception as e:
        logger.error(f"OpenAI API call failed: {e}")
        return ""
