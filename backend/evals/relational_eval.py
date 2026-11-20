"""Relation-aware grounded-correctness evaluator (experimental, diagnostic).

Ragas ``faithfulness`` decomposes an answer into independently-supported
statements and NLI-checks each against the retrieved contexts. On the retained
24-case benchmark, that structure missed the two tested reversed-causality
errors; more generally, statement-level decomposition can miss a wrong
relationship even when the component facts are supported. This module asks a
single, different question of one LLM call:

    Is the *complete meaning* of this answer supported by these contexts?

It is a measurement tool, not a product path. Like :mod:`evals.judges`, nothing
here touches ``app/services/llm.py``'s request path, no gate is added, and the
incumbent Ragas judge is left untouched. Judge selection is always explicit.

Design
------
* One structured call. Input: question, generated answer, retrieved contexts.
  Output: a fixed JSON object (see :data:`OUTPUT_SCHEMA_HINT`).
* Raw ``openai`` SDK transport — no ragas, no langchain — so it runs in the app
  venv and stubs cleanly for hermetic tests. The transport is injectable.
* Defensive parsing: an unknown verdict, a non-JSON body, or a transport error
  becomes :data:`INSUFFICIENT_DATA`. A malformed judge is never silently read as
  ``supported``.
* Grounded correctness is kept **separate from responsiveness**. This evaluator
  judges grounding only; whether the answer *addresses* the question is a
  different label (``expected_quality`` in the calibration set) and is not folded
  in here.

All ``app``/``openai`` imports are lazy so importing this module needs no API key
and pulls in no pipeline dependency.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, Sequence

logger = logging.getLogger("evals.relational_eval")

# -- verdict vocabulary ----------------------------------------------------

SUPPORTED = "supported"
PARTIALLY_SUPPORTED = "partially_supported"
UNSUPPORTED = "unsupported"

#: The three verdicts the judge may return.
KNOWN_VERDICTS = (SUPPORTED, PARTIALLY_SUPPORTED, UNSUPPORTED)

#: Sentinel assigned by the parser when the judge output cannot be trusted. The
#: judge can never emit this — it exists so a malformed or missing response is
#: recorded as "no usable answer" rather than coerced onto a real verdict.
INSUFFICIENT_DATA = "insufficient_data"

#: Transport signature: (config, system_prompt, user_prompt) -> raw response text.
Transport = Callable[["RelationalJudgeConfig", str, str], str]


# -- the rubric ------------------------------------------------------------

RUBRIC = """\
You are a strict grounding auditor. You are given a QUESTION, a generated ANSWER,
and the retrieved CONTEXTS the answer was supposed to be based on. Decide whether
the COMPLETE MEANING of the answer is supported by the contexts.

Judge grounding ONLY. Do not reward or penalise how well the answer addresses the
question — responsiveness is a separate concern handled elsewhere. A grounded
answer that does not address the question is still grounded.

Check every one of these, because an answer can name all the right entities and
still be wrong about how they relate:
1. Every factual claim: is each asserted by the contexts?
2. Numbers and quantities: do figures, ranges, and units match exactly?
3. Named entities: are people, systems, terms, and places the ones the contexts name?
4. Causal direction: does "A causes B" match the contexts, not the reverse?
5. Comparisons: are "greater/less/faster/more than" the same direction as the contexts?
6. Negation: does an added or dropped "not" flip a supported statement into an unsupported one?
7. Temporal relationships: is the order/timing (before/after/during) the same as the contexts?
8. Conjunctions: when the answer joins several claims, is EVERY conjunct supported?
9. Wrong-entity attribution: is a real fact attached to the entity the contexts attach it to?
10. Grounded but incomplete: an answer that omits parts of a fuller truth but whose
    stated claims are all supported is still SUPPORTED. Incompleteness alone is NEVER
    a reason to return unsupported.

Verdicts:
- "supported": every claim actually present in the answer is supported by the contexts.
  (An incomplete answer whose present claims are all grounded is supported.)
- "partially_supported": the answer MIXES supported and unsupported claims — some
  conjuncts are grounded and at least one is not. Reserve this for genuine mixtures,
  not for incompleteness.
- "unsupported": the answer's core assertion is contradicted by, or absent from, the
  contexts — including a reversed cause, a flipped comparison, a wrong number, a
  wrong-entity attribution, or a wholly invented claim.

Return ONLY a single JSON object with EXACTLY these keys:
  "verdict": one of "supported" | "partially_supported" | "unsupported"
  "unsupported_claims": array of short strings — claims not backed by the contexts
  "contradictions": array of short strings — claims the contexts actively contradict
  "relational_errors": array of short strings — reversed causality, flipped comparison,
      wrong-entity attribution, wrong number, or bad temporal order
  "reasoning_summary": a SHORT audit sentence citing what you checked and why the
      verdict follows. This is an audit note, NOT step-by-step private reasoning —
      do not include hidden chain-of-thought.
  "confidence": a number from 0.0 to 1.0

Do not output anything except that JSON object."""

#: Human-readable reminder of the output contract, surfaced in the user message.
OUTPUT_SCHEMA_HINT = (
    '{"verdict": "supported|partially_supported|unsupported", '
    '"unsupported_claims": [], "contradictions": [], "relational_errors": [], '
    '"reasoning_summary": "...", "confidence": 0.0}'
)


# -- result + config -------------------------------------------------------


@dataclass(frozen=True)
class RelationalResult:
    """One evaluator verdict. ``raw`` is kept for local debugging only."""

    verdict: str
    unsupported_claims: tuple[str, ...] = ()
    contradictions: tuple[str, ...] = ()
    relational_errors: tuple[str, ...] = ()
    reasoning_summary: str = ""
    confidence: Optional[float] = None
    ok: bool = True
    error: Optional[str] = None
    raw: Optional[str] = field(default=None, repr=False)

    @property
    def faithful(self) -> Optional[bool]:
        return verdict_to_faithful(self.verdict)


@dataclass(frozen=True)
class RelationalJudgeConfig:
    """Everything the transport needs to place one structured call for a judge."""

    judge: str
    model: str
    temperature: float
    seed: Optional[int] = None
    base_url: Optional[str] = None
    extra_body: Optional[dict[str, Any]] = None
    max_tokens: int = 1024


def verdict_to_faithful(verdict: str) -> Optional[bool]:
    """Map a verdict to the binary ``expected_faithfulness`` label space.

    ``supported`` -> faithful; ``partially_supported`` / ``unsupported`` ->
    unfaithful; ``insufficient_data`` -> ``None`` (excluded, reported separately).
    """
    if verdict == SUPPORTED:
        return True
    if verdict in (PARTIALLY_SUPPORTED, UNSUPPORTED):
        return False
    return None


# -- judge configuration ---------------------------------------------------


def resolve_judge_config(judge: str) -> RelationalJudgeConfig:
    """Build the call config for ``judge``. Pure w.r.t. the network.

    Constants come from the existing judge registry and the app's LLM module so
    there is a single source of truth (e.g. the ``KIMI_MODEL`` revert path). The
    ``app.services.llm`` import is lazy — it constructs an offline client at
    import time, so it needs the app settings, but never a live call.
    """
    from evals.judges import (  # lazy: keeps this module import hermetic
        JUDGE_KIMI,
        JUDGE_OPENAI,
        OPENAI_JUDGE_MODEL,
        OPENAI_JUDGE_SEED,
        OPENAI_JUDGE_TEMPERATURE,
        JudgeError,
        available_judges,
    )
    from evals.kimi_judge import KIMI_JUDGE_TEMPERATURE

    if judge == JUDGE_OPENAI:
        return RelationalJudgeConfig(
            judge=JUDGE_OPENAI,
            model=OPENAI_JUDGE_MODEL,
            temperature=OPENAI_JUDGE_TEMPERATURE,
            seed=OPENAI_JUDGE_SEED,
            base_url=None,
        )
    if judge == JUDGE_KIMI:
        from app.services.llm import KIMI_BASE_URL, KIMI_MODEL  # lazy: needs env

        return RelationalJudgeConfig(
            judge=JUDGE_KIMI,
            model=KIMI_MODEL,
            temperature=KIMI_JUDGE_TEMPERATURE,
            seed=None,  # Moonshot does not honour a seed on this model
            base_url=KIMI_BASE_URL,
            extra_body={"thinking": {"type": "disabled"}},
        )
    raise JudgeError(
        f"Unknown judge {judge!r}. Available: {', '.join(available_judges())}."
    )


# -- prompt assembly -------------------------------------------------------


def build_messages(
    question: str, answer: str, contexts: Sequence[str]
) -> tuple[str, str]:
    """Return ``(system, user)`` messages for one evaluation."""
    numbered = "\n".join(
        f"[{i}] {ctx}" for i, ctx in enumerate(contexts, start=1)
    ) or "[none]"
    user = (
        f"QUESTION:\n{question}\n\n"
        f"ANSWER:\n{answer}\n\n"
        f"CONTEXTS:\n{numbered}\n\n"
        f"Return only the JSON object described above, shaped like:\n{OUTPUT_SCHEMA_HINT}"
    )
    return RUBRIC, user


# -- defensive parsing -----------------------------------------------------


def _as_str_tuple(value: Any) -> tuple[str, ...]:
    if isinstance(value, (list, tuple)):
        return tuple(str(item) for item in value)
    return ()


def _as_confidence(value: Any) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    if number < 0.0:
        return 0.0
    if number > 1.0:
        return 1.0
    return number


def _insufficient(*, error: str, raw: Optional[str]) -> RelationalResult:
    return RelationalResult(
        verdict=INSUFFICIENT_DATA, ok=False, error=error, raw=raw
    )


def parse_relational_response(raw: Optional[str]) -> RelationalResult:
    """Validate a judge response into a :class:`RelationalResult`.

    Rejects anything it cannot trust rather than guessing. An unknown verdict, a
    body that is not a JSON object, or a missing verdict all become
    ``INSUFFICIENT_DATA`` — never ``supported``.
    """
    if not isinstance(raw, str) or not raw.strip():
        return _insufficient(error="empty or non-string response", raw=raw)
    try:
        data = json.loads(raw)
    except (ValueError, TypeError) as exc:
        return _insufficient(error=f"response was not valid JSON: {exc}", raw=raw)
    if not isinstance(data, dict):
        return _insufficient(error="response JSON was not an object", raw=raw)

    verdict = data.get("verdict")
    if verdict not in KNOWN_VERDICTS:
        return _insufficient(
            error=f"unknown or missing verdict {verdict!r}", raw=raw
        )

    return RelationalResult(
        verdict=verdict,
        unsupported_claims=_as_str_tuple(data.get("unsupported_claims")),
        contradictions=_as_str_tuple(data.get("contradictions")),
        relational_errors=_as_str_tuple(data.get("relational_errors")),
        reasoning_summary=str(data.get("reasoning_summary") or ""),
        confidence=_as_confidence(data.get("confidence")),
        ok=True,
        error=None,
        raw=raw,
    )


# -- transport -------------------------------------------------------------


def _default_transport(config: RelationalJudgeConfig, system: str, user: str) -> str:
    """Place one real structured call via the raw ``openai`` SDK.

    Lazy imports only; never exercised by the hermetic test suite (the transport
    is injected there).
    """
    from openai import OpenAI  # lazy

    from app.config import get_settings  # lazy: needs env

    settings = get_settings()
    api_key = (
        settings.kimi_api_key if config.judge == "kimi" else settings.openai_api_key
    )
    client_kwargs: dict[str, Any] = {"api_key": api_key}
    if config.base_url:
        client_kwargs["base_url"] = config.base_url
    client = OpenAI(**client_kwargs)

    call_kwargs: dict[str, Any] = {
        "model": config.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "response_format": {"type": "json_object"},
    }
    if config.seed is not None:
        call_kwargs["seed"] = config.seed
    if config.extra_body:
        call_kwargs["extra_body"] = config.extra_body

    response = client.chat.completions.create(**call_kwargs)
    return response.choices[0].message.content or ""


# -- public entry point ----------------------------------------------------


def evaluate_relational(
    question: str,
    answer: str,
    contexts: Sequence[str],
    *,
    judge: str,
    transport: Optional[Transport] = None,
) -> RelationalResult:
    """Evaluate one (question, answer, contexts) triple with one structured call.

    ``judge`` is keyword-only with no default: judge selection must be explicit.
    A transport error is caught and returned as ``INSUFFICIENT_DATA`` so a single
    flaky call never crashes a batch and is never mistaken for a real verdict.
    """
    config = resolve_judge_config(judge)
    system, user = build_messages(question, answer, contexts)
    call = transport or _default_transport
    try:
        raw = call(config, system, user)
    except Exception as exc:  # noqa: BLE001 — any transport failure is insufficient data
        logger.warning("relational judge %s transport failed: %s", judge, exc)
        return _insufficient(error=f"transport error: {exc}", raw=None)
    return parse_relational_response(raw)
