"""Ragas LLM-judge adapter for Kimi (Moonshot, OpenAI-compatible API).

Ragas accepts any LangChain `BaseChatModel`. Moonshot exposes an
OpenAI-compatible endpoint, so we point `langchain_openai.ChatOpenAI` at
Kimi's base URL with the existing `KIMI_API_KEY`. No extra deps beyond
`langchain-openai`, which is in `backend/evals/requirements.txt`.

Embeddings (needed by Ragas for some metrics) use OpenAI
`text-embedding-3-small` — the same model the app already pays for during
ingestion.
"""

from __future__ import annotations

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.llms import LangchainLLMWrapper

from app.config import get_settings
from app.services.llm import KIMI_BASE_URL, KIMI_MODEL


def build_judge_llm():
    """Return a Ragas-wrapped Kimi chat model for use as the LLM judge."""
    settings = get_settings()
    chat = ChatOpenAI(
        model=KIMI_MODEL,
        api_key=settings.kimi_api_key,
        base_url=KIMI_BASE_URL,
        # Lower temperature for grading consistency.
        temperature=0.0,
        max_tokens=2048,
        # Kimi v2.6 needs `thinking: disabled` for fast non-reasoning output;
        # ChatOpenAI passes unknown kwargs through `model_kwargs` -> extra_body.
        model_kwargs={"extra_body": {"thinking": {"type": "disabled"}}},
    )
    return LangchainLLMWrapper(chat)


def build_judge_embeddings():
    """Return a Ragas-wrapped embeddings client.

    Reuses the same OpenAI text-embedding-3-small the app uses, so chunks
    indexed at ingestion are directly comparable to judge-side embeddings.
    """
    settings = get_settings()
    emb = OpenAIEmbeddings(
        model="text-embedding-3-small",
        api_key=settings.openai_api_key,
    )
    return LangchainEmbeddingsWrapper(emb)
