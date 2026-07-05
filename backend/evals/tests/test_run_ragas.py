"""End-to-end orchestration tests for evals.run_ragas (SYNTHETIC fixtures).

Retrieval/answer/judge are injected as stubs — no network or API key needed.
"""

from __future__ import annotations

import logging

import pandas as pd
import pytest

import evals.run_ragas as rr
from evals.config import PlaceholderDocIdError


class _StubResult:
    def __init__(self, df):
        self._df = df

    def to_pandas(self):
        return self._df


def _stub_retrieve(query, document_id, top_k):
    return [f"TEST FIXTURE context for: {query}"]


def _stub_answer(question, contexts):
    base = contexts[0] if contexts else ""
    return f"TEST FIXTURE answer to: {question} | {base[:30]}"


def _stub_evaluator(dataset, metrics):
    n = len(dataset)
    return _StubResult(pd.DataFrame({
        "question": dataset["question"],
        "answer": dataset["answer"],
        "concept_label": dataset["concept_label"],
        "context_precision": [0.91] * n,
        "context_recall": [0.82] * n,
        "faithfulness": [1.0] * n,
        "answer_relevancy": [0.77] * n,
    }))


def test_build_dataset_uses_injected_adapters():
    pytest.importorskip("datasets")
    tuples = [
        {"question": "q1", "ideal_answer": "a1", "source_chunk_text": "s1", "concept_label": "c1"},
        {"question": "q2", "ideal_answer": "a2", "source_chunk_text": "s2", "concept_label": "c2"},
    ]
    ds = rr.build_dataset(tuples, document_id="doc-id", top_k=3,
                          retrieve=_stub_retrieve, answer=_stub_answer, doc="t")
    assert len(ds) == 2
    assert ds["question"] == ["q1", "q2"]
    assert ds["ground_truth"] == ["a1", "a2"]
    assert all(len(c) == 1 for c in ds["contexts"])
    assert ds["answer"][0].startswith("TEST FIXTURE answer to: q1")


def test_run_one_end_to_end_writes_csv(fixtures_dir, tmp_path, capsys):
    pytest.importorskip("datasets")
    df = rr.run_one("ddia_valid", limit=None, top_k=3,
                    retrieve=_stub_retrieve, answer=_stub_answer, evaluator=_stub_evaluator,
                    results_dir=tmp_path, no_langfuse=True, golden_dir=fixtures_dir)
    assert len(df) == 3
    for col in rr.METRIC_COLUMNS:
        assert col in df.columns
    csvs = list(tmp_path.glob("ddia_valid_*.csv"))
    assert len(csvs) == 1
    written = pd.read_csv(csvs[0])
    assert "faithfulness" in written.columns and len(written) == 3
    out = capsys.readouterr().out
    assert "ddia_valid" in out and "faithfulness" in out


def test_run_one_limit_caps_rows(fixtures_dir, tmp_path):
    pytest.importorskip("datasets")
    df = rr.run_one("ddia_valid", limit=1, top_k=3,
                    retrieve=_stub_retrieve, answer=_stub_answer, evaluator=_stub_evaluator,
                    results_dir=tmp_path, no_langfuse=True, golden_dir=fixtures_dir)
    assert len(df) == 1


def test_run_one_empty_tuples_returns_empty_no_csv(fixtures_dir, tmp_path):
    df = rr.run_one("ddia_empty", limit=None, top_k=3,
                    retrieve=_stub_retrieve, answer=_stub_answer, evaluator=_stub_evaluator,
                    results_dir=tmp_path, no_langfuse=True, golden_dir=fixtures_dir)
    assert len(df) == 0
    assert list(tmp_path.glob("*.csv")) == []


def test_run_one_placeholder_doc_id_raises(fixtures_dir, tmp_path):
    with pytest.raises(PlaceholderDocIdError):
        rr.run_one("ddia_placeholder", limit=None, top_k=3,
                   retrieve=_stub_retrieve, answer=_stub_answer, evaluator=_stub_evaluator,
                   results_dir=tmp_path, no_langfuse=True, golden_dir=fixtures_dir)


def test_default_evaluator_calls_ragas_with_resolved_metrics(monkeypatch):
    ragas = pytest.importorskip("ragas")
    from ragas.metrics import (answer_relevancy, context_precision,
                               context_recall, faithfulness)
    captured = {}

    def fake_evaluate(dataset, metrics=None, llm=None, embeddings=None):
        captured.update(dataset=dataset, metrics=list(metrics or []),
                        llm=llm, embeddings=embeddings)
        return _StubResult(pd.DataFrame({"faithfulness": [1.0]}))

    monkeypatch.setattr(ragas, "evaluate", fake_evaluate)
    sentinel = object()
    res = rr.default_evaluator(sentinel, list(rr.METRIC_COLUMNS),
                               llm="STUB_LLM", embeddings="STUB_EMB")
    assert isinstance(res.to_pandas(), pd.DataFrame)
    assert captured["dataset"] is sentinel
    # ragas metric objs are unhashable — compare by identity, not via set().
    expected = [context_precision, context_recall, faithfulness, answer_relevancy]
    assert len(captured["metrics"]) == len(expected)
    assert all(any(m is e for e in expected) for m in captured["metrics"])
    assert captured["llm"] == "STUB_LLM" and captured["embeddings"] == "STUB_EMB"


def test_cli_placeholder_doc_id_clean_error(fixtures_dir, capsys, caplog):
    with caplog.at_level(logging.ERROR):
        rc = rr.main(["--doc", "ddia_placeholder", "--limit", "5"], golden_dir=fixtures_dir)
    assert rc == 1
    assert "Traceback" not in capsys.readouterr().err
    joined = "\n".join(r.getMessage() for r in caplog.records)
    assert "placeholder" in joined.lower() or "document_id" in joined
    assert "Supabase" in joined or "documents.id" in joined


def test_cli_doc_all_discovers_configs(fixtures_dir, monkeypatch):
    calls = []

    def fake_run_one(doc, **kwargs):
        calls.append(doc)
        if doc == "ddia_placeholder":
            raise PlaceholderDocIdError("placeholder")
        return pd.DataFrame({"faithfulness": [1.0]})

    monkeypatch.setattr(rr, "run_one", fake_run_one)
    rc = rr.main(["--doc", "all"], golden_dir=fixtures_dir)
    assert rc == 1
    assert "ddia_valid" in calls and "ddia_placeholder" in calls


def test_cli_missing_doc_clean_error(fixtures_dir, capsys, caplog):
    with caplog.at_level(logging.ERROR):
        rc = rr.main(["--doc", "nonexistent_doc"], golden_dir=fixtures_dir)
    assert rc == 1
    assert "Traceback" not in capsys.readouterr().err
    joined = "\n".join(r.getMessage() for r in caplog.records)
    assert "Missing config" in joined or "nonexistent_doc" in joined
