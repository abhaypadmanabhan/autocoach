"""Ragas LLM-judge adapter for Kimi (Moonshot, OpenAI-compatible API).

Ragas accepts any LangChain ``BaseChatModel``. Moonshot exposes an
OpenAI-compatible endpoint, so we point ``langchain_openai.ChatOpenAI`` at
Kimi's base URL with the existing ``KIMI_API_KEY``. Embeddings reuse OpenAI
``text-embedding-3-small`` — the same model the app uses at ingestion.

All imports are **lazy** (inside the functions) so this module imports cleanly
without the app config, Qdrant, or any API keys. That lets the runner surface
a clean placeholder-doc-id error and lets unit tests stub the judge out.
"""

from __future__ import annotations


# Moonshot K2.6 rejects any temperature other than 0.6 with a 400
# ("invalid temperature: only 0.6 is allowed for this model").
KIMI_JUDGE_TEMPERATURE = 0.6


def build_judge_llm():
    """Return a Ragas-wrapped Kimi chat model for use as the LLM judge."""
    from langchain_openai import ChatOpenAI  # lazy: eval-only dep
    from ragas.llms import LangchainLLMWrapper  # lazy

    from app.config import get_settings  # lazy: needs env
    from app.services.llm import KIMI_BASE_URL, KIMI_MODEL  # lazy

    settings = get_settings()
    chat = ChatOpenAI(
        model=KIMI_MODEL,
        api_key=settings.kimi_api_key,
        base_url=KIMI_BASE_URL,
        temperature=KIMI_JUDGE_TEMPERATURE,
        max_tokens=2048,
        # Kimi v2.6 needs `thinking: disabled` for fast non-reasoning output;
        # Moonshot expects this provider-specific field in extra_body.
        extra_body={"thinking": {"type": "disabled"}},
    )

    try:

        class KimiLLMWrapper(LangchainLLMWrapper):
            # Ragas force-sets langchain_llm.temperature from get_temperature()
            # (1e-8 or 0.3) before every call, so pinning it on ChatOpenAI alone
            # is not enough — the wrapper must report Kimi's only legal value.
            def get_temperature(self, n: int) -> float:
                return KIMI_JUDGE_TEMPERATURE

            def generate_text(self, prompt, n=1, temperature=None, stop=None, callbacks=None):
                return super().generate_text(
                    prompt, n=n, temperature=KIMI_JUDGE_TEMPERATURE, stop=stop, callbacks=callbacks
                )

            async def agenerate_text(self, prompt, n=1, temperature=None, stop=None, callbacks=None):
                return await super().agenerate_text(
                    prompt, n=n, temperature=KIMI_JUDGE_TEMPERATURE, stop=stop, callbacks=callbacks
                )

    except TypeError:
        # Unit tests stub LangchainLLMWrapper with a plain callable that cannot
        # be subclassed; the temperature pin only matters against the live API.
        return LangchainLLMWrapper(chat)

    return KimiLLMWrapper(chat)


def build_judge_embeddings():
    """Return a Ragas-wrapped embeddings client.

    Reuses OpenAI text-embedding-3-small (the app's ingestion model) so chunks
    indexed at ingestion are directly comparable to judge-side embeddings.
    """
    from langchain_openai import OpenAIEmbeddings  # lazy
    from ragas.embeddings import LangchainEmbeddingsWrapper  # lazy

    from app.config import get_settings  # lazy: needs env

    settings = get_settings()
    emb = OpenAIEmbeddings(model="text-embedding-3-small", api_key=settings.openai_api_key)
    return LangchainEmbeddingsWrapper(emb)
