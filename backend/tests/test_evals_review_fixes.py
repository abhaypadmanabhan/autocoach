"""Regression tests for eval harness review fixes."""

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


def test_kimi_judge_passes_thinking_as_top_level_extra_body(monkeypatch):
    """Moonshot thinking config must be sent via ChatOpenAI.extra_body."""
    captured = {}

    class FakeChatOpenAI:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    _stub_module(
        monkeypatch,
        "langchain_openai",
        ChatOpenAI=FakeChatOpenAI,
        OpenAIEmbeddings=MagicMock(),
    )
    _stub_module(monkeypatch, "ragas.embeddings", LangchainEmbeddingsWrapper=MagicMock())
    _stub_module(
        monkeypatch,
        "ragas.llms",
        LangchainLLMWrapper=lambda chat: chat,
    )
    fake_settings = types.SimpleNamespace(kimi_api_key="kimi-key")
    fake_config = _stub_module(
        monkeypatch,
        "app.config",
        get_settings=lambda: fake_settings,
    )
    fake_llm = _stub_module(
        monkeypatch,
        "app.services.llm",
        KIMI_BASE_URL="https://moonshot.example/v1",
        KIMI_MODEL="kimi-k2.6",
    )

    sys.modules.pop("evals.kimi_judge", None)
    module = importlib.import_module("evals.kimi_judge")
    module.build_judge_llm()

    assert captured["extra_body"] == {"thinking": {"type": "disabled"}}
    assert "model_kwargs" not in captured

    sys.modules.pop("evals.kimi_judge", None)
    monkeypatch.setitem(sys.modules, "app.config", fake_config)
    monkeypatch.setitem(sys.modules, "app.services.llm", fake_llm)


def test_ragas_upload_uses_langfuse_v4_create_score(monkeypatch):
    """Ragas aggregate upload must use v4 create_score, not trace/score."""
    _stub_module(monkeypatch, "datasets", Dataset=object)
    _stub_module(monkeypatch, "ragas", evaluate=lambda *_args, **_kwargs: None)
    _stub_module(
        monkeypatch,
        "ragas.metrics",
        answer_relevancy=object(),
        context_precision=object(),
        context_recall=object(),
        faithfulness=object(),
    )
    _stub_module(monkeypatch, "app.services.llm", call_kimi=lambda *_args: "")
    _stub_module(
        monkeypatch,
        "app.services.retrieval",
        retrieve_relevant_chunks=lambda **_kwargs: [],
    )
    _stub_module(
        monkeypatch,
        "evals.kimi_judge",
        build_judge_embeddings=lambda: object(),
        build_judge_llm=lambda: object(),
    )

    fake_client = MagicMock()
    fake_client.create_trace_id.return_value = "0" * 32
    fake_span = MagicMock()
    fake_client.start_as_current_observation.return_value.__enter__.return_value = (
        fake_span
    )
    fake_observability = _stub_module(
        monkeypatch,
        "app.observability.langfuse",
        is_enabled=lambda: True,
        langfuse=fake_client,
    )
    fake_propagate = MagicMock()
    _stub_module(
        monkeypatch,
        "langfuse",
        propagate_attributes=fake_propagate,
    )

    sys.modules.pop("evals.run_ragas", None)
    module = importlib.import_module("evals.run_ragas")

    class FakeSeries:
        empty = False

        def mean(self):
            return 0.75

    class FakeColumn:
        def dropna(self):
            return FakeSeries()

    class FakeDataFrame:
        columns = ("context_precision", "faithfulness")

        def __len__(self):
            return 2

        def __getitem__(self, _key):
            return FakeColumn()

    module._maybe_upload_to_langfuse("ddia", FakeDataFrame())

    assert fake_client.trace.call_count == 0
    assert fake_client.score.call_count == 0
    assert fake_client.create_score.call_count == 2
    for call in fake_client.create_score.call_args_list:
        assert call.kwargs["trace_id"] == "0" * 32
        assert call.kwargs["data_type"] == "NUMERIC"
    fake_client.start_as_current_observation.assert_called_once_with(
        name="ragas_eval",
        as_type="span",
        trace_context={"trace_id": "0" * 32},
        metadata={"doc": "ddia", "rows": 2},
    )
    fake_propagate.assert_called_once_with(
        trace_name="ragas_eval",
        metadata={"doc": "ddia", "rows": 2},
        tags=["eval", "ragas", "ddia"],
    )
    fake_client.flush.assert_called_once()

    sys.modules.pop("evals.run_ragas", None)
    monkeypatch.setitem(sys.modules, "app.observability.langfuse", fake_observability)
