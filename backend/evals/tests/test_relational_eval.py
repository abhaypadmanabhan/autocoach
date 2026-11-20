"""Unit tests for the relation-aware grounded-correctness evaluator core.

Hermetic: the judge transport is always injected, so no network call and no API
key is ever needed. The two ``resolve_judge_config`` tests set dummy keys only so
the lazy ``app.services.llm`` import (which constructs an offline client at import)
succeeds; construction with a fake key touches no network.
"""

from __future__ import annotations

import dataclasses
import json

import pytest

from evals.relational_eval import (
    INSUFFICIENT_DATA,
    PARTIALLY_SUPPORTED,
    RUBRIC,
    SUPPORTED,
    UNSUPPORTED,
    RelationalResult,
    evaluate_relational,
    parse_relational_response,
    resolve_judge_config,
    verdict_to_faithful,
)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def _payload(**over):
    body = {
        "verdict": "supported",
        "unsupported_claims": [],
        "contradictions": [],
        "relational_errors": [],
        "reasoning_summary": "audit",
        "confidence": 0.9,
    }
    body.update(over)
    return json.dumps(body)


def _transport(payload):
    """A fake transport returning a fixed response, recording it was called."""

    def _t(config, system, user):
        _t.calls.append({"config": config, "system": system, "user": user})
        if isinstance(payload, BaseException):
            raise payload
        return payload

    _t.calls = []
    return _t


Q, A, C = "why?", "X because Y.", ("context one", "context two")


# --------------------------------------------------------------------------
# verdict -> binary faithfulness mapping (requirement 6)
# --------------------------------------------------------------------------


def test_verdict_to_faithful_mapping():
    assert verdict_to_faithful(SUPPORTED) is True
    assert verdict_to_faithful(PARTIALLY_SUPPORTED) is False
    assert verdict_to_faithful(UNSUPPORTED) is False
    assert verdict_to_faithful(INSUFFICIENT_DATA) is None


# --------------------------------------------------------------------------
# detection behaviors (requirement 10 test list)
# --------------------------------------------------------------------------


def test_reversed_causality_detected():
    transport = _transport(
        _payload(verdict="unsupported", relational_errors=["causal direction reversed: Y->X not X->Y"])
    )
    result = evaluate_relational(Q, A, C, judge="openai", transport=transport)
    assert result.ok is True
    assert result.verdict == UNSUPPORTED
    assert result.relational_errors  # non-empty
    assert verdict_to_faithful(result.verdict) is False


def test_incorrect_number_detected():
    transport = _transport(
        _payload(verdict="unsupported", contradictions=["answer says 500, context says 50"])
    )
    result = evaluate_relational(Q, "The rate is 500.", C, judge="openai", transport=transport)
    assert result.verdict == UNSUPPORTED
    assert result.contradictions
    assert verdict_to_faithful(result.verdict) is False


def test_unsupported_appended_claim_detected():
    transport = _transport(
        _payload(verdict="partially_supported", unsupported_claims=["appended claim not in context"])
    )
    result = evaluate_relational(Q, A, C, judge="openai", transport=transport)
    assert result.verdict == PARTIALLY_SUPPORTED
    assert result.unsupported_claims
    # partial support maps to unfaithful per requirement 6.
    assert verdict_to_faithful(result.verdict) is False


def test_faithful_answer_stays_supported():
    transport = _transport(_payload(verdict="supported"))
    result = evaluate_relational(Q, A, C, judge="openai", transport=transport)
    assert result.verdict == SUPPORTED
    assert not result.unsupported_claims and not result.contradictions
    assert verdict_to_faithful(result.verdict) is True


def test_incomplete_but_grounded_not_unsupported_for_incompleteness():
    # Model returns supported for a grounded-but-partial answer; mapping keeps it faithful.
    transport = _transport(_payload(verdict="supported", reasoning_summary="all present claims grounded; omits some"))
    result = evaluate_relational(Q, A, C, judge="openai", transport=transport)
    assert result.verdict == SUPPORTED
    assert verdict_to_faithful(result.verdict) is True
    # The rubric must instruct that incompleteness alone is not "unsupported".
    lowered = RUBRIC.lower()
    assert "incomplete" in lowered
    assert "supported" in lowered


def test_non_responsive_grounded_answer_stays_grounded():
    # A grounded answer that does not address the question is still grounded.
    transport = _transport(_payload(verdict="supported"))
    result = evaluate_relational(Q, A, C, judge="openai", transport=transport)
    assert result.verdict == SUPPORTED
    assert verdict_to_faithful(result.verdict) is True
    # Grounded correctness is kept separate from responsiveness: the result carries
    # no responsiveness field, and the rubric says so explicitly.
    field_names = {f.name for f in dataclasses.fields(RelationalResult)}
    assert "responsiveness" not in field_names
    assert "responsive" in RUBRIC.lower()


# --------------------------------------------------------------------------
# defensive parsing (requirement 9)
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw",
    [
        "not json at all",
        "",
        "[1, 2, 3]",  # valid JSON but not an object
        json.dumps({"unsupported_claims": []}),  # missing verdict
        json.dumps({"verdict": "totally_supported"}),  # unknown verdict
        json.dumps({"verdict": None}),
        json.dumps({"verdict": "SUPPORTED "}),  # not an exact known token
    ],
)
def test_malformed_output_becomes_insufficient_data(raw):
    result = parse_relational_response(raw)
    assert result.verdict == INSUFFICIENT_DATA
    assert result.ok is False
    # Never silently coerced to supported.
    assert result.verdict != SUPPORTED
    assert verdict_to_faithful(result.verdict) is None


def test_transport_failure_becomes_insufficient_data():
    transport = _transport(RuntimeError("boom"))
    result = evaluate_relational(Q, A, C, judge="openai", transport=transport)
    assert result.verdict == INSUFFICIENT_DATA
    assert result.ok is False
    assert result.error and "boom" in result.error


def test_unknown_verdict_is_rejected_not_coerced():
    result = parse_relational_response(json.dumps({"verdict": "mostly_ok", "confidence": 1.0}))
    assert result.verdict == INSUFFICIENT_DATA
    assert result.ok is False


def test_confidence_is_clamped_or_dropped():
    assert parse_relational_response(_payload(confidence=1.5)).confidence == 1.0
    assert parse_relational_response(_payload(confidence=-0.2)).confidence == 0.0
    assert parse_relational_response(_payload(confidence="high")).confidence is None
    assert parse_relational_response(_payload(confidence=None)).confidence is None


def test_non_list_claim_fields_are_coerced_to_empty():
    result = parse_relational_response(
        _payload(verdict="supported", unsupported_claims="oops", contradictions=None)
    )
    assert result.verdict == SUPPORTED
    assert result.unsupported_claims == ()
    assert result.contradictions == ()


def test_raw_output_preserved_for_debugging():
    raw = _payload(verdict="supported")
    result = parse_relational_response(raw)
    assert result.raw == raw


# --------------------------------------------------------------------------
# judge selection is explicit (requirement 4)
# --------------------------------------------------------------------------


def test_openai_judge_config_is_deterministic():
    config = resolve_judge_config("openai")
    assert config.judge == "openai"
    assert config.model == "gpt-4o-mini"
    assert config.temperature == 0.0
    assert config.seed == 0
    assert config.base_url is None  # default OpenAI endpoint


def test_kimi_judge_config_uses_moonshot(monkeypatch):
    # Only three settings are required; set them so the lazy, offline
    # ``app.services.llm`` import (which builds a client at import) succeeds.
    monkeypatch.setenv("QDRANT_URL", "http://localhost")
    monkeypatch.setenv("QDRANT_API_KEY", "test")
    monkeypatch.setenv("KIMI_API_KEY", "test")
    config = resolve_judge_config("kimi")
    assert config.judge == "kimi"
    assert config.model == "kimi-k2.6"
    assert config.temperature == 0.6
    assert config.base_url == "https://api.moonshot.ai/v1"
    assert config.extra_body == {"thinking": {"type": "disabled"}}
    assert config.seed is None  # Moonshot does not honour a seed


def test_unknown_judge_raises():
    from evals.judges import JudgeError

    with pytest.raises(JudgeError):
        resolve_judge_config("gemini")


def test_evaluate_requires_explicit_judge():
    # judge is keyword-only with no default: selection must be explicit.
    with pytest.raises(TypeError):
        evaluate_relational(Q, A, C, transport=_transport(_payload()))  # type: ignore[call-arg]


def test_default_ragas_judge_is_not_changed():
    # The new evaluator must not touch the incumbent default judge.
    from evals.judges import DEFAULT_JUDGE

    assert DEFAULT_JUDGE == "kimi"


# --------------------------------------------------------------------------
# no forbidden dependencies (requirement 10)
# --------------------------------------------------------------------------


def test_module_imports_no_pipeline_dependencies():
    import inspect

    import evals.relational_eval as mod

    # Scan import statements only (prose in docstrings may mention these names).
    import_lines = [
        line.strip()
        for line in inspect.getsource(mod).splitlines()
        if line.strip().startswith(("import ", "from "))
    ]
    blob = "\n".join(import_lines)
    for forbidden in ("qdrant", "supabase", "retrieval", "langfuse", "run_ragas", "quiz_generator", "ragas"):
        assert forbidden not in blob, f"relational_eval must not import {forbidden!r}"
