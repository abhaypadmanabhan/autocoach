"""Regression tests for the Kimi judge adapter (hermetic, stubbed deps)."""

from __future__ import annotations

import importlib
import sys
import types

from unittest.mock import MagicMock


def _stub_module(monkeypatch, name: str, **attrs):
    module = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    monkeypatch.setitem(sys.modules, name, module)
    return module


def test_judge_llm_pins_kimi_only_legal_temperature(monkeypatch):
    """Moonshot K2.6 400s on any temperature except 0.6.

    Ragas' LangchainLLMWrapper force-sets ``langchain_llm.temperature`` from
    ``get_temperature()`` (1e-8 / 0.3) before every call, so the wrapper
    subclass must report 0.6 and the ChatOpenAI ctor must start there too.
    """
    captured = {}

    class FakeChatOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    class SubclassableWrapper:
        def __init__(self, chat):
            self.langchain_llm = chat

        def get_temperature(self, n: int) -> float:
            return 0.3 if n > 1 else 1e-8

    _stub_module(
        monkeypatch,
        "langchain_openai",
        ChatOpenAI=FakeChatOpenAI,
        OpenAIEmbeddings=MagicMock(),
    )
    _stub_module(monkeypatch, "ragas.llms", LangchainLLMWrapper=SubclassableWrapper)
    _stub_module(
        monkeypatch,
        "app.config",
        get_settings=lambda: types.SimpleNamespace(kimi_api_key="kimi-key"),
    )
    _stub_module(
        monkeypatch,
        "app.services.llm",
        KIMI_BASE_URL="https://moonshot.example/v1",
        KIMI_MODEL="kimi-k2.6",
    )

    sys.modules.pop("evals.kimi_judge", None)
    module = importlib.import_module("evals.kimi_judge")
    try:
        judge = module.build_judge_llm()
    finally:
        sys.modules.pop("evals.kimi_judge", None)

    assert captured["temperature"] == module.KIMI_JUDGE_TEMPERATURE == 0.6
    # The subclass must override ragas' per-call temperature schedule.
    assert judge.get_temperature(n=1) == 0.6
    assert judge.get_temperature(n=3) == 0.6
