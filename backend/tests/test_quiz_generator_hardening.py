import json

from app.services import quiz_generator


def _mcq_question(**overrides):
    question = {
        "question_type": "text_mcq",
        "question_text": "What does replication improve?",
        "options": ["A) Availability", "B) Latency only", "C) Syntax", "D) Formatting"],
        "correct_answer": "A",
        "explanation": "Replication keeps data available across nodes.",
        "concept_id": "concept-1",
    }
    question.update(overrides)
    return question


def _generate_with_responses(monkeypatch, responses, focus_concept_ids=None):
    calls = []
    response_iter = iter(responses)

    monkeypatch.setattr(
        quiz_generator,
        "retrieve_relevant_chunks",
        lambda **_kwargs: [{"content": "Replication improves availability."}],
    )

    def fake_call_kimi(_system_prompt, _user_prompt):
        calls.append("kimi")
        return next(response_iter)

    monkeypatch.setattr(quiz_generator, "call_kimi", fake_call_kimi)
    monkeypatch.setattr(quiz_generator, "call_openai", lambda *_args, **_kwargs: "")

    result = quiz_generator.generate_quiz_questions(
        document_id="doc-1",
        num_questions=1,
        difficulty="medium",
        question_types=["text_mcq"],
        focus_concept_ids=focus_concept_ids,
    )

    return result, calls


def test_generate_quiz_retries_then_rejects_oversized_question_text(monkeypatch):
    oversized = json.dumps([_mcq_question(question_text="x" * 2001)])

    result, calls = _generate_with_responses(monkeypatch, [oversized, oversized])

    assert result == []
    assert calls == ["kimi", "kimi"]


def test_generate_quiz_rejects_concept_id_outside_focus_allowlist(monkeypatch):
    invalid = json.dumps([_mcq_question(concept_id="concept-2")])

    result, calls = _generate_with_responses(
        monkeypatch,
        [invalid, invalid],
        focus_concept_ids=["concept-1"],
    )

    assert result == []
    assert calls == ["kimi", "kimi"]


def test_generate_quiz_rejects_mcq_without_exactly_four_options(monkeypatch):
    invalid = json.dumps([_mcq_question(options=["A) One", "B) Two", "C) Three"])])

    result, calls = _generate_with_responses(monkeypatch, [invalid, invalid])

    assert result == []
    assert calls == ["kimi", "kimi"]


def test_generate_quiz_uses_openai_fallback_when_kimi_raises(monkeypatch):
    openai_calls = []
    valid = json.dumps([_mcq_question(concept_id=None)])

    monkeypatch.setattr(
        quiz_generator,
        "retrieve_relevant_chunks",
        lambda **_kwargs: [{"content": "Replication improves availability."}],
    )
    monkeypatch.setattr(
        quiz_generator,
        "call_kimi",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("kimi down")),
    )

    def fake_call_openai(_system_prompt, _user_prompt, temperature):
        openai_calls.append(temperature)
        return valid

    monkeypatch.setattr(quiz_generator, "call_openai", fake_call_openai)

    result = quiz_generator.generate_quiz_questions(
        document_id="doc-1",
        num_questions=1,
        difficulty="medium",
        question_types=["text_mcq"],
    )

    assert len(result) == 1
    assert result[0]["question_text"] == "What does replication improve?"
    assert openai_calls == [0.7]
