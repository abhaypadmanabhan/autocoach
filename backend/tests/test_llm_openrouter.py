"""Primary-LLM backend selection: OpenRouter when its key is set, else Kimi direct.

No network: `llm.OpenAI` is patched with a recording fake."""

from types import SimpleNamespace
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
    base = dict(kimi_api_key="kimi-k", openrouter_api_key="", openrouter_model="moonshotai/kimi-k2.6")
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
    assert kwargs["extra_body"] == {"reasoning": {"enabled": False}}


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
