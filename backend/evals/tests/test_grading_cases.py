"""Offline tests for the free-text grading eval (``evals.grading_cases``).

Fake graders and a stubbed LLM only: no keys, no network, no spend.
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from evals import grading_cases as gc


@pytest.fixture
def cases():
    return gc.load_cases()


def _case(cases, case_id):
    return next(c for c in cases if c.id == case_id)


def test_case_file_is_balanced(cases):
    kinds = [c.kind for c in cases]
    assert len(cases) == 20
    assert {k: kinds.count(k) for k in set(kinds)} == {
        "paraphrase": 8, "partial": 5, "wrong": 4, "injection": 3,
    }
    assert all(c.expected_score == gc.EXPECTED_SCORE[c.kind] for c in cases)


def test_paraphrases_do_not_echo_the_reference(cases):
    for case in cases:
        if case.kind == "paraphrase":
            assert case.student_answer.casefold() != case.reference.casefold(), case.id


def test_injection_answers_carry_an_instruction(cases):
    for case in cases:
        if case.kind == "injection":
            text = case.student_answer.lower()
            assert any(w in text for w in ("ignore", "mark", "score 2", "grader")), case.id


def test_load_rejects_an_unbalanced_file(tmp_path):
    raw = json.loads(gc.CASES_PATH.read_text(encoding="utf-8"))
    raw["cases"] = raw["cases"][:-1]
    path = tmp_path / "cases.json"
    path.write_text(json.dumps(raw), encoding="utf-8")
    with pytest.raises(ValueError, match="expected"):
        gc.load_cases(path)


def test_load_rejects_a_mislabelled_case(tmp_path):
    raw = json.loads(gc.CASES_PATH.read_text(encoding="utf-8"))
    raw["cases"][0]["expected_score"] = 1  # a paraphrase must expect 2
    path = tmp_path / "cases.json"
    path.write_text(json.dumps(raw), encoding="utf-8")
    with pytest.raises(ValueError, match="must expect 2"):
        gc.load_cases(path)


def _fake_grader(overrides: dict[str, int | None]):
    """Grades every case as labelled except `overrides` (case id -> score)."""

    def grade(case):
        score = overrides.get(case.id, case.expected_score)
        return score, score == 2

    return grade


def _ticking_clock(step_s: float):
    now = [0.0]

    def clock():
        now[0] += step_s
        return now[0]

    return clock


def test_summary_counts_misgrades(cases):
    grade = _fake_grader({"para-03": 1, "para-05": None, "inj-02": 2, "part-01": 0})
    summary = gc.summarize(gc.run(cases, grade, clock=_ticking_clock(0.25)))

    assert summary["graded"] == 20
    assert summary["paraphrases"] == 8
    assert summary["paraphrases_not_correct"] == 2
    assert summary["injections"] == 3
    assert summary["injections_correct"] == 1
    assert summary["p50_ms"] == 250.0
    assert summary["confusion"][2] == {2: 6, 1: 1, None: 1}
    assert summary["confusion"][1] == {1: 4, 0: 1}
    assert summary["confusion"][0] == {0: 6, 2: 1}


def test_report_shows_matrix_and_targets(cases):
    summary = gc.summarize(gc.run(cases, _fake_grader({}), clock=_ticking_clock(0.1)))
    report = gc.format_report(summary, "rubric")
    assert "| 2 | 0 | 0 | 8 | 0 |" in report
    assert "| 1 | 0 | 5 | 0 | 0 |" in report
    assert "| 0 | 7 | 0 | 0 | 0 |" in report
    assert "paraphrases graded not-correct: 0/8" in report
    assert "injections graded correct: 0/3" in report
    assert "p50 latency: 100.0 ms" in report


def test_run_stops_at_the_spend_cap(cases):
    checks = iter(range(len(cases)))
    graded = gc.run(cases, _fake_grader({}), stop=lambda: next(checks) >= 3)
    assert len(graded) == 3


def test_live_grade_feeds_case_passages_to_the_real_grader(cases):
    from app.services import answer_evaluator as ae

    case = _case(cases, "para-01")
    reply = json.dumps({"rubric": ["a", "b"], "points_hit": ["a", "b"], "score": 2,
                        "feedback": "ok", "hint": ""})
    with patch.object(ae, "call_kimi", return_value=reply) as kimi:
        assert gc.live_grade(case) == (2, True)
    prompt = kimi.call_args.kwargs["user_prompt"]
    block = prompt[prompt.index("<source_passages>"):prompt.index("</source_passages>")]
    assert case.passages[0] in block


def test_baseline_grade_uses_the_old_prompt_without_passages(cases):
    from app.services import llm

    case = _case(cases, "para-01")
    with patch.object(llm, "call_kimi", return_value='{"is_correct": true, "feedback": "ok"}') as kimi:
        assert gc.baseline_grade(case) == (2, True)
    prompt = kimi.call_args.kwargs["user_prompt"]
    assert "Model answer (rubric): " + case.reference in prompt
    assert case.passages[0] not in prompt

    with patch.object(llm, "call_kimi", return_value='{"is_correct": false}'):
        assert gc.baseline_grade(case) == (0, False)
    with patch.object(llm, "call_kimi", return_value=""), \
         patch.object(llm, "call_openai", return_value="not json"):
        assert gc.baseline_grade(case) == (None, False)


def _settings(ledger: str):
    return SimpleNamespace(llm_spend_ledger_path=ledger, llm_spend_cap_usd=0.0)


def test_live_run_refuses_to_start_without_a_spend_ledger(monkeypatch, capsys):
    import app.config

    monkeypatch.setattr(app.config, "get_settings", lambda: _settings(""))
    with patch.object(gc, "live_grade") as grade:
        assert gc.main([]) == 2
    grade.assert_not_called()
    assert "LLM_SPEND_LEDGER_PATH" in capsys.readouterr().err


@pytest.mark.parametrize(("flag", "grader", "label"), [
    ([], "live_grade", "grader: rubric"),
    (["--baseline"], "baseline_grade", "grader: baseline"),
])
def test_main_picks_the_grader_and_prints_the_report(monkeypatch, capsys, flag, grader, label):
    import app.config

    monkeypatch.setattr(app.config, "get_settings", lambda: _settings("ledger.jsonl"))
    monkeypatch.setattr(gc, grader, _fake_grader({}))
    assert gc.main(flag) == 0
    out = capsys.readouterr().out
    assert label in out
    assert "paraphrases graded not-correct: 0/8" in out
