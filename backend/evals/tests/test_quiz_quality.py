"""Quiz-quality eval: scoring, replay and gate. No network, no keys."""

from __future__ import annotations

import json

import pytest

from evals import quiz_quality as qq

GOOD = "quiz_quality_good.jsonl"
PLANTED_BAD = "quiz_quality_planted_bad.jsonl"

CONTEXT = [
    {"chunk_index": 0, "content": "The mitochondrion is the organelle that produces most of the cell's ATP."},
    {"chunk_index": 1, "content": "Ribosomes assemble proteins from amino acids."},
]


def _mcq(**overrides):
    question = {
        "question_type": "text_mcq",
        "question_text": "Which organelle produces most of the cell's ATP?",
        "options": ["A) Ribosome", "B) Mitochondrion", "C) Nucleus", "D) Golgi apparatus"],
        "correct_answer": "B",
        "context_chunks": CONTEXT,
    }
    question.update(overrides)
    return question


# ---- structural checks -----------------------------------------------------


@pytest.mark.parametrize(
    "key, expected",
    [
        ("B", "B"),
        ("b)", "B"),
        ("B) Mitochondrion", "B"),
        ("Mitochondrion", "B"),
        ("  mitochondrion ", "B"),
        ("Chloroplast", None),
        ("E", None),
    ],
)
def test_key_letter_resolves_every_key_style(key, expected):
    assert qq.key_letter(_mcq(correct_answer=key)) == expected


def test_a_clean_mcq_has_no_structural_problems():
    assert qq.structural_problems(_mcq()) == []


def test_duplicate_options_are_caught_despite_letter_prefix_and_case():
    question = _mcq(options=["A) Ribosome", "B) Mitochondrion", "C) ribosome", "D) Nucleus"])
    assert "duplicate_options" in qq.structural_problems(question)


def test_catch_all_option_and_missing_key_are_caught():
    question = _mcq(
        options=["A) Ribosome", "B) Mitochondrion", "C) Nucleus", "D) All of the above"],
        correct_answer="Chloroplast",
    )
    assert set(qq.structural_problems(question)) == {"catch_all_option", "key_not_an_option"}


def test_true_false_key_must_be_true_or_false():
    question = {"question_type": "text_tf", "question_text": "x", "correct_answer": "yes"}
    assert qq.structural_problems(question) == ["key_not_true_false"]


def test_key_length_outlier_flags_only_a_conspicuously_long_key():
    long_key = _mcq(options=[
        "A) Ribosome",
        "B) The mitochondrion, through oxidative phosphorylation on its inner membrane",
        "C) Nucleus",
        "D) Golgi",
    ])
    assert qq.key_length_outlier(long_key) is True
    assert qq.key_length_outlier(_mcq()) is False


# ---- quote check -------------------------------------------------------------


def test_quote_matches_across_whitespace_case_and_curly_quotes():
    quote = "the  MITOCHONDRION is the organelle that produces most of the cell’s ATP"
    assert qq.quote_in_context(quote, [c["content"] for c in CONTEXT]) is True


def test_quote_matches_across_pdf_line_wraps_and_punctuation_drift():
    passage = "Each inspec-\ntion records four readings: lens clarity, battery volt-\nage and tilt."
    quote = "Each inspection records four readings — lens clarity, battery voltage, and tilt"
    assert qq.quote_in_context(quote, [passage]) is True


def test_a_changed_word_is_still_not_a_match():
    passage = "Each inspection records four readings: lens clarity, battery voltage and tilt."
    assert qq.quote_in_context("Each inspection records five readings: lens clarity", [passage]) is False


def test_paraphrased_or_tiny_quote_is_not_evidence():
    passages = [c["content"] for c in CONTEXT]
    assert qq.quote_in_context("Mitochondria make most of the ATP in a cell.", passages) is False
    assert qq.quote_in_context("the cell's ATP", passages) is False
    assert qq.quote_in_context("", passages) is False


# ---- solver reply parsing ----------------------------------------------------


def test_solver_reply_is_parsed_from_fenced_or_chatty_output():
    reply = 'Sure!\n```json\n{"answer": "b", "quote": "Ribosomes assemble proteins"}\n```'
    assert qq.parse_solver_reply(reply) == {"answer": "B", "quote": "Ribosomes assemble proteins"}
    assert qq.parse_solver_reply('{"answer": "True"}') == {"answer": "true", "quote": ""}


@pytest.mark.parametrize("reply", ["", "no json here", "{not json}", "[1, 2]"])
def test_unusable_solver_reply_is_none(reply):
    assert qq.parse_solver_reply(reply) is None


def test_open_book_prompt_shows_passages_and_options_but_never_the_key():
    prompt = qq.open_book_prompt(_mcq(explanation="Mitochondrion, obviously: option B."))
    assert "produces most of the cell's ATP" in prompt
    assert "B) Mitochondrion" in prompt
    assert "obviously" not in prompt
    assert "correct_answer" not in prompt


def test_closed_book_prompt_has_no_passages():
    assert "Ribosomes assemble proteins" not in qq.closed_book_prompt(_mcq())


# ---- row scoring -------------------------------------------------------------


def _raw(question, open_book, closed_book=None):
    return {"doc": "d", "mode": "default", "question": question,
            "open_book": open_book, "closed_book": closed_book, "latency_s": 1.0}


def test_valid_row_needs_clean_structure_and_solver_agreement():
    quote = "The mitochondrion is the organelle that produces most of the cell's ATP."
    scored = qq.score_row(_raw(_mcq(), {"answer": "B", "quote": quote}, {"answer": "A"}))
    assert (scored["valid"], scored["evidence_hit"], scored["guessable"]) == (True, True, False)


def test_wrong_key_is_invalid_even_with_clean_structure():
    scored = qq.score_row(_raw(_mcq(correct_answer="C"), {"answer": "B", "quote": ""}))
    assert scored["problems"] == [] and scored["valid"] is False


def test_solver_agreement_cannot_rescue_a_structural_defect():
    question = _mcq(options=["A) Ribosome", "B) Mitochondrion", "C) Mitochondrion", "D) Nucleus"])
    scored = qq.score_row(_raw(question, {"answer": "B", "quote": ""}))
    assert scored["solver_agrees"] is True and scored["valid"] is False


def test_failed_generation_is_an_incomplete_row():
    scored = qq.score_row({"doc": "d", "question": None, "latency_s": 9.0})
    assert scored["completed"] is False and "valid" not in scored


def test_generator_source_quote_is_checked_when_present():
    question = _mcq(source_quote="Mitochondria are the powerhouse of the cell, as everyone knows.")
    scored = qq.score_row(_raw(question, {"answer": "B", "quote": ""}))
    assert scored["source_quote_verbatim"] is False
    assert qq.score_row(_raw(_mcq(), {"answer": "B", "quote": ""}))["source_quote_verbatim"] is None


# ---- collection with fakes ---------------------------------------------------


def test_collect_records_cost_latency_and_both_solver_passes():
    spent = [0.0]
    prompts = []

    def generate(document_id, concept, requested_type, mode):
        spent[0] += 0.002
        return _mcq() if requested_type == "text_mcq" else None

    def solve(prompt):
        prompts.append(prompt)
        return '{"answer": "B", "quote": "x"}'

    rows = qq.collect(
        [qq.EvalDoc("doc", "doc-id")],
        per_doc=2,
        modes=["default"],
        load_concepts=lambda _id: [{"id": 1, "concept_name": "ATP"}, {"id": 2, "concept_name": "TF"}, {"id": 3}],
        generate=generate,
        solve=solve,
        spend_total=lambda: spent[0],
    )

    assert [r["requested_type"] for r in rows] == ["text_mcq", "text_tf"]
    assert rows[0]["gen_cost_usd"] == pytest.approx(0.002)
    assert rows[0]["open_book"] == {"answer": "B", "quote": "x"} == rows[0]["closed_book"] | {"quote": "x"}
    assert rows[1]["question"] is None and "open_book" not in rows[1]
    assert len(prompts) == 2  # solver cost is not charged to generation
    assert rows[0]["gen_cost_usd"] == pytest.approx(rows[1]["gen_cost_usd"])


def test_collect_stops_when_the_spend_cap_is_hit():
    rows = qq.collect(
        [qq.EvalDoc("doc", "doc-id")],
        per_doc=5,
        modes=["default"],
        load_concepts=lambda _id: [{"id": i, "concept_name": str(i)} for i in range(5)],
        generate=lambda *a: None,
        solve=lambda p: "",
        spend_total=lambda: 0.0,
        stop=lambda: True,
    )
    assert rows == []


# ---- replay + gate -----------------------------------------------------------


def test_good_recording_summary(fixtures_dir):
    scored = [qq.score_row(r) for r in qq.read_recording(fixtures_dir / GOOD)]
    summary = qq.summarize(scored)

    assert summary["attempted"] == summary["completed"] == 8
    assert summary["validity_rate"] == 1.0
    assert summary["evidence_hit_rate"] == 1.0
    assert summary["guess_rate"] == pytest.approx(2 / 6, abs=1e-4)
    assert summary["guess_rate_mcq"] == 0.5
    assert summary["source_quote_verbatim_rate"] == 1.0
    assert summary["p50_latency_s"] == 2.15
    assert summary["cost_per_quiz_usd"] == pytest.approx(0.002)
    assert qq.gate_failures(summary) == []


def test_replay_gate_passes_on_the_good_recording(fixtures_dir, capsys):
    assert qq.main(["--replay", str(fixtures_dir / GOOD), "--gate"]) == 0
    assert "GATE PASS" in capsys.readouterr().out


def test_replay_gate_fails_on_the_planted_bad_recording(fixtures_dir, capsys):
    assert qq.main(["--replay", str(fixtures_dir / PLANTED_BAD), "--gate"]) == 1
    err = capsys.readouterr().err
    # One bad quote in seven judged rows (0.857) stays above the 0.80 floor.
    assert "validity_rate 0.571" in err and "completion_rate 0.875" in err
    assert "evidence_hit_rate" not in err


def test_planted_defects_are_each_attributed(fixtures_dir):
    scored = [qq.score_row(r) for r in qq.read_recording(fixtures_dir / PLANTED_BAD)]

    assert scored[0]["problems"] == [] and scored[0]["solver_agrees"] is False  # wrong key
    assert scored[2]["problems"] == ["duplicate_options"]
    assert scored[3]["evidence_hit"] is False  # quote not in the passages
    assert scored[5]["completed"] is False  # generation returned nothing


def test_gate_treats_a_missing_metric_as_a_failure():
    summary = qq.summarize([qq.score_row({"doc": "d", "question": None})])
    failures = qq.gate_failures(summary)
    assert "validity_rate: no data" in failures and any("completion_rate" in f for f in failures)


def test_replay_writes_nothing(fixtures_dir, tmp_path):
    assert qq.main(["--replay", str(fixtures_dir / GOOD), "--out-dir", str(tmp_path)]) == 0
    assert list(tmp_path.iterdir()) == []


def test_recording_round_trips(tmp_path):
    rows = [{"doc": "d", "question": _mcq(question_text="¿Qué orgánulo?")}]
    path = tmp_path / "nested" / "r.jsonl"
    qq.write_recording(rows, path)
    assert qq.read_recording(path) == json.loads(json.dumps(rows))


def test_live_run_refuses_to_start_without_a_spend_ledger(monkeypatch, capsys):
    from types import SimpleNamespace

    import app.config

    monkeypatch.setattr(
        app.config, "get_settings",
        lambda: SimpleNamespace(llm_spend_ledger_path="", llm_spend_cap_usd=0.0),
    )
    assert qq.main(["--doc", "none"]) == 2
    assert "LLM_SPEND_LEDGER_PATH" in capsys.readouterr().err


def test_rejudge_replaces_solver_replies_and_keeps_the_question(fixtures_dir):
    rows = qq.read_recording(fixtures_dir / GOOD)
    prompts = []

    def solve(prompt):
        prompts.append(prompt)
        return '{"answer": "unknown", "quote": ""}'

    judged = qq.rejudge(rows, solve=solve)

    assert [r["question"] for r in judged] == [r["question"] for r in rows]
    assert all(r["open_book"] == {"answer": "unknown", "quote": ""} for r in judged)
    assert "closed_book" not in judged[3]  # free text has no closed-book pass
    assert len(prompts) == 8 + 6
    assert qq.summarize([qq.score_row(r) for r in judged])["validity_rate"] == 0.0
    assert rows[0]["open_book"]["answer"] == "B"  # the input recording is untouched


def test_free_text_open_book_prompt_judges_the_reference_answer():
    question = {"question_type": "text_free", "question_text": "What do ribosomes do?",
                "correct_answer": "They assemble proteins.", "context_chunks": CONTEXT}
    prompt = qq.open_book_prompt(question)
    assert "Reference answer: They assemble proteins." in prompt
    assert '"supported" or "unsupported"' in prompt and '"quote"' in prompt

