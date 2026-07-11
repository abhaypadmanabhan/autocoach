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


def test_ragas_upload_uses_row_traces_and_aggregate_scores(monkeypatch):
    """Ragas upload must use v4 create_score with row traces + aggregate means."""
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
    aggregate_trace_id = "0" * 32
    row_trace_1 = "1" * 32
    row_trace_2 = "2" * 32
    fake_client.create_trace_id.side_effect = [
        aggregate_trace_id,
        row_trace_1,
        row_trace_2,
    ]
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
        def __init__(self, values):
            self.values = values
            self.empty = not values

        def mean(self):
            return sum(self.values) / len(self.values)

    class FakeColumn:
        def __init__(self, values):
            self.values = values

        def dropna(self):
            return FakeSeries([v for v in self.values if v is not None])

    class FakeDataFrame:
        rows = [
            {
                "row_index": 1,
                "question": "TEST FIXTURE question one?",
                "document_label": "TEST FIXTURE doc",
                "concept_label": "concept-one",
                "answer": "TEST FIXTURE generated answer one.",
                "context_count": 3,
                "retrieval_hit_at_k": True,
                "context_precision": 0.5,
                "context_recall": 0.6,
                "faithfulness": 0.7,
                "answer_relevancy": 0.8,
                "contexts": ["DO NOT UPLOAD FULL CONTEXT"],
                "source_chunk_text": "DO NOT UPLOAD SOURCE",
            },
            {
                "row_index": 2,
                "question": "TEST FIXTURE question two?",
                "document_label": "TEST FIXTURE doc",
                "concept_label": "concept-two",
                "answer": "TEST FIXTURE generated answer two.",
                "context_count": 2,
                "retrieval_hit_at_k": False,
                "context_precision": 1.0,
                "context_recall": 0.8,
                "faithfulness": 0.9,
                "answer_relevancy": 1.0,
                "contexts": ["DO NOT UPLOAD FULL CONTEXT"],
                "source_chunk_text": "DO NOT UPLOAD SOURCE",
            },
        ]
        columns = tuple(rows[0].keys())

        def __len__(self):
            return len(self.rows)

        def __getitem__(self, key):
            return FakeColumn([row[key] for row in self.rows])

        def iterrows(self):
            for idx, row in enumerate(self.rows):
                yield idx, row

    module._maybe_upload_to_langfuse("ddia", FakeDataFrame())

    assert fake_client.trace.call_count == 0
    assert fake_client.score.call_count == 0
    assert fake_client.create_trace_id.call_count == 3
    assert fake_client.create_score.call_count == len(module.REPORTED_METRIC_COLUMNS) * 3
    for call in fake_client.create_score.call_args_list:
        assert call.kwargs["data_type"] == "NUMERIC"
    fake_client.start_as_current_observation.assert_any_call(
        name="ragas_eval_aggregate",
        as_type="span",
        trace_context={"trace_id": aggregate_trace_id},
        metadata={"doc": "ddia", "rows": 2, "document_label": "TEST FIXTURE doc"},
    )
    fake_propagate.assert_any_call(
        trace_name="ragas_eval_aggregate",
        metadata={"doc": "ddia", "rows": 2, "document_label": "TEST FIXTURE doc"},
        tags=["eval", "ragas", "ddia", "aggregate"],
    )
    row_calls = [
        call for call in fake_client.start_as_current_observation.call_args_list
        if call.kwargs["name"] == "ragas_eval_row"
    ]
    assert len(row_calls) == 2
    first_row_metadata = row_calls[0].kwargs["metadata"]
    assert first_row_metadata["question"] == "TEST FIXTURE question one?"
    assert first_row_metadata["document_label"] == "TEST FIXTURE doc"
    assert first_row_metadata["concept_label"] == "concept-one"
    assert first_row_metadata["generated_answer"] == "TEST FIXTURE generated answer one."
    assert first_row_metadata["retrieval_hit_at_k"] is True
    assert first_row_metadata["retrieved_contexts"] == {
        "context_count": 3,
        "chunk_ids": [],
    }
    assert "contexts" not in first_row_metadata
    assert "source_chunk_text" not in first_row_metadata

    aggregate_scores = {
        call.kwargs["name"]: call.kwargs["value"]
        for call in fake_client.create_score.call_args_list
        if call.kwargs["trace_id"] == aggregate_trace_id
    }
    assert aggregate_scores["context_precision"] == 0.75
    assert aggregate_scores["context_recall"] == 0.7
    assert aggregate_scores["retrieval_hit_at_k"] == 0.5
    assert aggregate_scores["faithfulness"] == 0.8
    assert aggregate_scores["answer_relevancy"] == 0.9

    fake_propagate.assert_any_call(
        trace_name="ragas_eval_row",
        metadata={"doc": "ddia", "rows": 2},
        tags=["eval", "ragas", "ddia", "row"],
    )
    assert fake_propagate.call_count == 3
    fake_client.flush.assert_called_once()

    sys.modules.pop("evals.run_ragas", None)
    monkeypatch.setitem(sys.modules, "app.observability.langfuse", fake_observability)
