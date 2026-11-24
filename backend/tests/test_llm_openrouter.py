"""Primary-LLM backend selection: OpenRouter when its key is set, else Kimi direct.

No network: `llm.OpenAI` is patched with a recording fake."""

from types import SimpleNamespace

import pytest
from unittest.mock import MagicMock, patch

from app.services import llm


def _fake_openai(response_model: str):
    created = {}
    client = MagicMock()
    client.chat.completions.create.return_value = SimpleNamespace(
        model=response_model,
        choices=[SimpleNamespace(message=SimpleNamespace(content="hi"))],
        usage=SimpleNamespace(prompt_tokens=1, completion_tokens=2, total_tokens=3),
    )

    def factory(**kwargs):
        created.update(kwargs)
        return client

    return factory, created, client


def _settings(**kw):
    base = dict(
        kimi_api_key="kimi-k",
        openrouter_api_key="",
        openrouter_model="moonshotai/kimi-k2.6",
        openrouter_max_price_prompt=0.15,
        openrouter_max_price_completion=0.60,
        openai_api_key="oa-k",
        llm_spend_ledger_path="",
        llm_spend_cap_usd=0.0,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_openrouter_key_routes_to_openrouter():
    factory, created, client = _fake_openai("moonshotai/kimi-k2.6")
    with patch.object(llm, "settings", _settings(openrouter_api_key="or-k")), patch.object(llm, "OpenAI", factory):
        out = llm.call_kimi("sys", "user")

    assert out == "hi"
    assert out.model == "moonshotai/kimi-k2.6"
    assert created == {"api_key": "or-k", "base_url": "https://openrouter.ai/api/v1"}
    kwargs = client.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == "moonshotai/kimi-k2.6"
    assert kwargs["extra_body"] == {
        "reasoning": {"enabled": False},
        "provider": {"max_price": {"prompt": 0.15, "completion": 0.60}},
    }


def test_openrouter_model_is_configurable():
    factory, _, client = _fake_openai("openai/gpt-4o-mini")
    s = _settings(openrouter_api_key="or-k", openrouter_model="openai/gpt-4o-mini")
    with patch.object(llm, "settings", s), patch.object(llm, "OpenAI", factory):
        assert llm.call_kimi("sys", "user").model == "openai/gpt-4o-mini"
    assert client.chat.completions.create.call_args.kwargs["model"] == "openai/gpt-4o-mini"


def test_without_openrouter_key_still_uses_kimi_direct():
    factory, created, client = _fake_openai("kimi-k2.6")
    with patch.object(llm, "settings", _settings()), patch.object(llm, "OpenAI", factory):
        assert llm.call_kimi("sys", "user") == "hi"

    assert created == {"api_key": "kimi-k", "base_url": "https://api.moonshot.ai/v1"}
    kwargs = client.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == "kimi-k2.6"
    assert kwargs["extra_body"] == {"thinking": {"type": "disabled"}}


def test_openrouter_failure_is_labelled_and_returns_empty():
    fake = MagicMock(name="LangfuseClient")
    with patch.object(llm, "settings", _settings(openrouter_api_key="or-k")), \
         patch.object(llm, "OpenAI", side_effect=RuntimeError("401")), \
         patch.object(llm, "get_client", return_value=fake):
        assert llm.call_kimi("sys", "user") == ""

    assert "OpenRouter" in fake.update_current_span.call_args.kwargs["status_message"]


def test_call_options_reach_openrouter():
    factory, _, client = _fake_openai("openai/gpt-6-luna")
    with patch.object(llm, "settings", _settings(openrouter_api_key="or-k")), patch.object(llm, "OpenAI", factory):
        llm.call_kimi(
            "sys",
            "user",
            model="openai/gpt-6-luna",
            temperature=0,
            response_format={"type": "json_object"},
            max_tokens=300,
        )

    kwargs = client.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == "openai/gpt-6-luna"
    assert kwargs["temperature"] == 0
    assert kwargs["response_format"] == {"type": "json_object"}
    assert kwargs["max_tokens"] == 300


def test_kimi_direct_ignores_model_and_temperature_overrides():
    factory, _, client = _fake_openai("kimi-k2.6")
    with patch.object(llm, "settings", _settings()), patch.object(llm, "OpenAI", factory):
        llm.call_kimi("sys", "user", model="openai/gpt-6-luna", temperature=0)

    kwargs = client.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == "kimi-k2.6"
    assert "temperature" not in kwargs


def test_spend_ledger_prices_openrouter_calls_at_the_ceiling(tmp_path):
    ledger = tmp_path / "spend.jsonl"
    factory, _, client = _fake_openai("moonshotai/kimi-k2.6")
    client.chat.completions.create.return_value.usage = SimpleNamespace(
        prompt_tokens=1_000_000, completion_tokens=500_000, total_tokens=1_500_000
    )
    s = _settings(openrouter_api_key="or-k", llm_spend_ledger_path=str(ledger))
    with patch.object(llm, "settings", s), patch.object(llm, "OpenAI", factory):
        llm.call_kimi("sys", "user")
        # 1M prompt x $0.15 + 0.5M completion x $0.60
        assert llm.spend_total() == pytest.approx(0.45)


def test_spend_ledger_uses_reported_cost_when_higher(tmp_path):
    ledger = tmp_path / "spend.jsonl"
    factory, _, client = _fake_openai("moonshotai/kimi-k2.6")
    client.chat.completions.create.return_value.usage = SimpleNamespace(
        prompt_tokens=10, completion_tokens=10, total_tokens=20, cost=0.5
    )
    s = _settings(openrouter_api_key="or-k", llm_spend_ledger_path=str(ledger))
    with patch.object(llm, "settings", s), patch.object(llm, "OpenAI", factory):
        llm.call_kimi("sys", "user")
        assert llm.spend_total() == 0.5


def test_spend_cap_refuses_primary_and_fallback_calls(tmp_path):
    ledger = tmp_path / "spend.jsonl"
    ledger.write_text('{"cost_usd": 1.0}\n{"cost_usd": 0.8}\n')
    factory, _, client = _fake_openai("moonshotai/kimi-k2.6")
    s = _settings(
        openrouter_api_key="or-k",
        llm_spend_ledger_path=str(ledger),
        llm_spend_cap_usd=1.80,
    )
    with patch.object(llm, "settings", s), patch.object(llm, "OpenAI", factory):
        assert llm.call_kimi("sys", "user") == ""
        assert llm.call_openai("sys", "user") == ""

    client.chat.completions.create.assert_not_called()


def test_no_ledger_means_no_cap_and_no_file(tmp_path):
    factory, _, client = _fake_openai("moonshotai/kimi-k2.6")
    s = _settings(openrouter_api_key="or-k", llm_spend_cap_usd=0.01)
    with patch.object(llm, "settings", s), patch.object(llm, "OpenAI", factory):
        assert llm.call_kimi("sys", "user") == "hi"
        assert llm.spend_total() == 0.0
    assert list(tmp_path.iterdir()) == []
