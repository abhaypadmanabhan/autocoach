"""Live-traffic observability tests (#73).

Covers the three things issue #73 added on top of the existing tracing:

1. ``LANGFUSE_SAMPLE_RATE`` reaching the v4 constructor, with 1.0 (today's
   unsampled behaviour) as the default.
2. One score emitted from the *live* quiz path — ``evaluate_free_text`` —
   under a name distinct from the offline harness's ``ragas_eval``.
3. Kimi/OpenAI cascade failures marking the current observation ERROR.

Every Langfuse client here is a ``MagicMock``. No network, no LLM tokens.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.config import Settings
from app.observability import langfuse as obs
from app.services import answer_evaluator as ae
from app.services import llm


def _settings(**overrides) -> Settings:
    base = {
        "qdrant_url": "http://localhost",
        "qdrant_api_key": "x",
        "kimi_api_key": "x",
        "langfuse_public_key": "pk-test",
        "langfuse_secret_key": "sk-test",
        "langfuse_host": "http://langfuse.example",
    }
    base.update(overrides)
    return Settings(**base)


@pytest.fixture(autouse=True)
def _restore_client():
    saved = obs.langfuse
    yield
    obs.langfuse = saved


def _ctor_kwargs(settings: Settings) -> dict:
    with patch("app.observability.langfuse.get_settings", return_value=settings):
        with patch("app.observability.langfuse.Langfuse") as mock_ctor:
            with patch(
                "app.observability.langfuse.get_client", return_value=MagicMock()
            ):
                obs._reset_for_tests()
                return mock_ctor.call_args.kwargs


# ---------------------------------------------------------------------------
# 1. sample_rate
# ---------------------------------------------------------------------------


def test_sample_rate_defaults_to_fully_unsampled():
    """Default must preserve today's behaviour exactly: every trace exported."""
    assert _ctor_kwargs(_settings())["sample_rate"] == 1.0


def test_sample_rate_propagates_configured_value():
    assert _ctor_kwargs(_settings(langfuse_sample_rate=0.25))["sample_rate"] == 0.25


@pytest.mark.parametrize("bad", [-0.5, 1.5, 42.0])
def test_sample_rate_out_of_range_falls_back_to_one(bad):
    """The SDK raises outside [0, 1] and _init_client swallows constructor
    errors — a typo must mis-sample at worst, never kill all tracing."""
    assert _ctor_kwargs(_settings(langfuse_sample_rate=bad))["sample_rate"] == 1.0


def test_bad_sample_rate_still_produces_a_live_client():
    settings = _settings(langfuse_sample_rate=9.0)
    with patch("app.observability.langfuse.get_settings", return_value=settings):
        with patch("app.observability.langfuse.Langfuse"):
            with patch(
                "app.observability.langfuse.get_client", return_value=MagicMock()
            ):
                obs._reset_for_tests()
                assert obs.is_enabled() is True


# ---------------------------------------------------------------------------
# 2. score_current_trace helper
# ---------------------------------------------------------------------------


def test_score_is_a_noop_when_client_is_none():
    obs.langfuse = None
    obs.score_current_trace("answer_correct", 1.0)  # must not raise


def test_score_forwards_to_the_client():
    fake = MagicMock(name="LangfuseClient")
    obs.langfuse = fake
    obs.score_current_trace("answer_correct", 0.0, comment="why")
    fake.score_current_trace.assert_called_once_with(
        name="answer_correct", value=0.0, data_type="NUMERIC", comment="why"
    )


def test_score_swallows_client_exceptions():
    fake = MagicMock(name="LangfuseClient")
    fake.score_current_trace.side_effect = RuntimeError("no active span")
    obs.langfuse = fake
    obs.score_current_trace("answer_correct", 1.0)  # must not raise


# ---------------------------------------------------------------------------
# 3. Live score on the real quiz path
# ---------------------------------------------------------------------------


def test_live_score_name_is_distinct_from_the_offline_harness():
    assert ae.LIVE_ANSWER_SCORE_NAME != "ragas_eval"


@pytest.mark.parametrize(
    ("verdict", "expected_value"), [("true", 1.0), ("false", 0.0)]
)
def test_graded_answer_emits_a_live_score(verdict, expected_value):
    fake = MagicMock(name="LangfuseClient")
    obs.langfuse = fake

    with patch.object(
        ae, "call_kimi", return_value='{"is_correct": %s, "feedback": "ok"}' % verdict
    ):
        is_correct, _feedback, _explanation = ae.evaluate_free_text(
            "user answer", "model answer", "question?", session_id="s1", user_id="u1"
        )

    assert is_correct is (expected_value == 1.0)
    fake.score_current_trace.assert_called_once()
    kwargs = fake.score_current_trace.call_args.kwargs
    assert kwargs["name"] == ae.LIVE_ANSWER_SCORE_NAME
    assert kwargs["name"] != "ragas_eval"
    assert kwargs["value"] == expected_value


def test_no_score_when_the_client_is_disabled():
    """NOOP path: grading still works, nothing is emitted."""
    obs.langfuse = None
    with patch.object(
        ae, "call_kimi", return_value='{"is_correct": true, "feedback": "ok"}'
    ):
        is_correct, _feedback, _explanation = ae.evaluate_free_text(
            "user answer", "model answer", "question?"
        )
    assert is_correct is True


def test_ungraded_answer_marks_error_and_emits_no_score():
    """Both providers dead: fail closed, mark ERROR, keep the score clean."""
    fake = MagicMock(name="LangfuseClient")
    obs.langfuse = fake

    with patch.object(ae, "call_kimi", return_value=""):
        with patch.object(ae, "call_openai", return_value=""):
            with patch.object(llm, "get_client", return_value=fake):
                is_correct, feedback, _explanation = ae.evaluate_free_text(
                    "user answer", "model answer", "question?"
                )

    assert is_correct is False
    assert "retry" in feedback.lower()
    fake.score_current_trace.assert_not_called()
    assert fake.update_current_span.call_args.kwargs["level"] == "ERROR"


def test_unparseable_json_marks_error_and_emits_no_score():
    fake = MagicMock(name="LangfuseClient")
    obs.langfuse = fake

    with patch.object(ae, "call_kimi", return_value="not json at all"):
        with patch.object(llm, "get_client", return_value=fake):
            is_correct, _feedback, _explanation = ae.evaluate_free_text(
                "user answer", "model answer", "question?"
            )

    assert is_correct is False
    fake.score_current_trace.assert_not_called()
    assert fake.update_current_span.call_args.kwargs["level"] == "ERROR"


# ---------------------------------------------------------------------------
# 4. Cascade failures mark the observation ERROR
# ---------------------------------------------------------------------------


def test_kimi_failure_marks_the_observation_error():
    fake = MagicMock(name="LangfuseClient")
    with patch.object(llm, "OpenAI", side_effect=RuntimeError("connection refused")):
        with patch.object(llm, "get_client", return_value=fake):
            assert llm.call_kimi("sys", "user") == ""

    kwargs = fake.update_current_span.call_args.kwargs
    assert kwargs["level"] == "ERROR"
    assert "Kimi" in kwargs["status_message"]


def test_openai_failure_marks_the_observation_error():
    fake = MagicMock(name="LangfuseClient")
    with patch.object(llm, "OpenAI", side_effect=RuntimeError("connection refused")):
        with patch.object(llm, "get_client", return_value=fake):
            assert llm.call_openai("sys", "user") == ""

    kwargs = fake.update_current_span.call_args.kwargs
    assert kwargs["level"] == "ERROR"
    assert "OpenAI" in kwargs["status_message"]


def test_error_tagging_never_breaks_the_request_path():
    """A dead Langfuse client must not turn an LLM outage into a 500."""
    fake = MagicMock(name="LangfuseClient")
    fake.update_current_span.side_effect = RuntimeError("exporter down")
    with patch.object(llm, "OpenAI", side_effect=RuntimeError("connection refused")):
        with patch.object(llm, "get_client", return_value=fake):
            assert llm.call_kimi("sys", "user") == ""


def test_status_message_is_truncated():
    fake = MagicMock(name="LangfuseClient")
    with patch.object(llm, "get_client", return_value=fake):
        llm.mark_current_observation_error("x" * 5000)
    assert len(fake.update_current_span.call_args.kwargs["status_message"]) == 500
