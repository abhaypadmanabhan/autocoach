"""Judge-backend registry for the Ragas eval harness.

The harness scores with an LLM judge. Which judge is a *measurement* choice, not
a product choice: nothing here touches ``app/services/llm.py`` or any request
path the app serves. Two backends are registered:

``kimi``
    Moonshot Kimi K2.6 — the incumbent, and still the default. Moonshot rejects
    any temperature other than 0.6 on this model, so the judge cannot be pinned
    to a deterministic setting. See :mod:`evals.kimi_judge`.

``openai``
    OpenAI ``gpt-4o-mini`` at ``temperature=0`` with a fixed ``seed``. Uses the
    ``OPENAI_API_KEY`` already required by the project (embeddings at ingestion,
    LLM fallback), so it adds no new credential.

Why temperature matters here: Ragas asks the judge for a *fresh* generation on
every metric call and normally leaves it near-greedy — ``LangchainLLMWrapper.
get_temperature`` returns ``1e-8`` for ``n == 1`` (and ``0.3`` for ``n > 1``).
The Kimi wrapper has to override that to 0.6 for every call, which makes each
scoring pass a fresh sample rather than a repeatable measurement.

All imports are lazy so this module imports cleanly without API keys, letting
the CLI surface clean errors and letting unit tests stub judges out.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from evals.kimi_judge import KIMI_JUDGE_TEMPERATURE

JUDGE_KIMI = "kimi"
JUDGE_OPENAI = "openai"

#: Incumbent judge. Deliberately unchanged — calibration measures the default,
#: it does not silently replace it.
DEFAULT_JUDGE = JUDGE_KIMI

OPENAI_JUDGE_MODEL = "gpt-4o-mini"
OPENAI_JUDGE_TEMPERATURE = 0.0
#: Fixed seed makes OpenAI sampling reproducible on a best-effort basis. It is
#: not a hard guarantee (the API documents it as best-effort), which is exactly
#: what the repeatability experiment is here to measure.
OPENAI_JUDGE_SEED = 0


class JudgeError(ValueError):
    """Unknown judge name, or a judge that cannot be constructed."""


@dataclass(frozen=True)
class JudgeSpec:
    """Static description of a judge backend — safe to log, holds no secrets."""

    name: str
    provider: str
    model: str
    temperature: float
    deterministic: bool
    notes: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "judge": self.name,
            "provider": self.provider,
            "model": self.model,
            "temperature": self.temperature,
            "deterministic": self.deterministic,
            "notes": self.notes,
        }


def _kimi_spec() -> JudgeSpec:
    from app.services.llm import KIMI_MODEL  # lazy: needs env

    return JudgeSpec(
        name=JUDGE_KIMI,
        provider="moonshot",
        model=KIMI_MODEL,
        temperature=KIMI_JUDGE_TEMPERATURE,
        deterministic=False,
        notes="Moonshot rejects any temperature but 0.6 on this model.",
    )


def _openai_spec() -> JudgeSpec:
    return JudgeSpec(
        name=JUDGE_OPENAI,
        provider="openai",
        model=OPENAI_JUDGE_MODEL,
        temperature=OPENAI_JUDGE_TEMPERATURE,
        deterministic=True,
        notes=f"temperature=0, seed={OPENAI_JUDGE_SEED} (best-effort reproducibility).",
    )


def _build_openai_judge_llm():
    """OpenAI judge pinned as close to greedy decoding as the API allows."""
    from langchain_openai import ChatOpenAI  # lazy: eval-only dep
    from ragas.llms import LangchainLLMWrapper  # lazy

    from app.config import get_settings  # lazy: needs env

    settings = get_settings()
    chat = ChatOpenAI(
        model=OPENAI_JUDGE_MODEL,
        api_key=settings.openai_api_key,
        temperature=OPENAI_JUDGE_TEMPERATURE,
        max_tokens=2048,
        seed=OPENAI_JUDGE_SEED,
    )

    try:

        class DeterministicLLMWrapper(LangchainLLMWrapper):
            # Ragas re-sets langchain_llm.temperature from get_temperature()
            # before every call (1e-8 for n==1, 0.3 for n>1). answer_relevancy
            # issues `strictness` separate generations, so without this pin the
            # judge would drift on exactly the metric we are trying to measure.
            def get_temperature(self, n: int) -> float:
                return OPENAI_JUDGE_TEMPERATURE

        return DeterministicLLMWrapper(chat)
    except TypeError:
        # Unit tests stub LangchainLLMWrapper with a plain callable that cannot
        # be subclassed; the temperature pin only matters against the live API.
        return LangchainLLMWrapper(chat)


_JUDGE_BUILDERS: dict[str, Callable[[], Any]] = {}
_JUDGE_SPECS: dict[str, Callable[[], JudgeSpec]] = {
    JUDGE_KIMI: _kimi_spec,
    JUDGE_OPENAI: _openai_spec,
}


def _kimi_builder():
    from evals.kimi_judge import build_judge_llm as _build  # lazy

    return _build()


_JUDGE_BUILDERS[JUDGE_KIMI] = _kimi_builder
_JUDGE_BUILDERS[JUDGE_OPENAI] = _build_openai_judge_llm


def available_judges() -> tuple[str, ...]:
    """Registered judge names, stable order."""
    return tuple(sorted(_JUDGE_BUILDERS))


def describe_judge(name: str) -> JudgeSpec:
    """Static spec for ``name``. Raises :class:`JudgeError` if unregistered."""
    try:
        return _JUDGE_SPECS[name]()
    except KeyError as exc:
        raise JudgeError(
            f"Unknown judge {name!r}. Available: {', '.join(available_judges())}."
        ) from exc


def build_judge_llm(name: str = DEFAULT_JUDGE):
    """Build the Ragas-wrapped judge LLM for ``name``.

    Selection is always explicit at the call site — there is no environment
    variable that can flip the judge out from under a run.
    """
    try:
        builder = _JUDGE_BUILDERS[name]
    except KeyError as exc:
        raise JudgeError(
            f"Unknown judge {name!r}. Available: {', '.join(available_judges())}."
        ) from exc
    return builder()


def build_judge_embeddings():
    """Shared embeddings for every judge.

    ``answer_relevancy`` scores cosine similarity between the original question
    and questions the judge reverse-generates from the answer. Holding the
    embedding model fixed across judges keeps that comparison attributable to
    the judge rather than to the embedding space.
    """
    from evals.kimi_judge import build_judge_embeddings as _build  # lazy

    return _build()
