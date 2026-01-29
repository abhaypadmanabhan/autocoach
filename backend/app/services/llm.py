"""LLM service for calling Kimi and OpenAI APIs."""

import logging

from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Kimi API configuration
KIMI_BASE_URL = "https://api.moonshot.ai/v1"
KIMI_MODEL = "kimi-k2.5"


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
        logger.info(f"Kimi API call successful, response length: {len(content) if content else 0}")
        return content if content else ""
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
        return content if content else ""
    except Exception as e:
        logger.error(f"OpenAI API call failed: {e}")
        return ""
