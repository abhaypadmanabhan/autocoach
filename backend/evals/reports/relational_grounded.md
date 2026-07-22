# Relation-aware grounded correctness — comparison report

Experimental, diagnostic evaluator (`evals/relational_eval.py` + `evals/relational_agreement.py`).
Scored all 24 balanced calibration cases with both judges (Kimi, OpenAI) at 3 replicates
(144 single structured calls), then compared against the retained Ragas faithfulness
observations on the same 24 cases. **No gate is added; Ragas faithfulness and the default
judge are unchanged.** This report carries identifiers, labels, and numbers only — never
questions, answers, or contexts.

## Findings (honest read)

- **Big win on added-claim and wrong-number leniency.** Kimi caught every appended/combined/
  fabricated claim (7/7) and every swapped number (3/3), lifting negative recall from Ragas
  faithfulness's **0.083 → 0.833** and balanced accuracy **0.542 → 0.792** on the same cases.
  This is where Ragas faithfulness is weakest and the relational evaluator clearly helps.
- **No win on the relational inversions it was built for — 0/2, both judges.** Both
  `reverse_causal` cases returned `supported` on all six replicates from both judges. The
  reversed answers are genuine causal inversions (verified against the human rationale), but
  the judges silently re-normalised the causal direction and scored the component facts as
  present — the *same* statement-presence blind spot Ragas faithfulness has. An explicit
  "check causal direction" rubric item was not enough to change this behaviour.
- **A new false-negative mode: responsiveness leaks into grounding.** Both `swap_question`
  cases (grounded but paired with a neighbour's question → non-responsive, labelled *faithful*)
  were marked `unsupported` by both judges. Despite the rubric instructing grounding-only, the
  judges penalised the question/answer mismatch. Kimi also over-flagged one `drop_sentence`
  (incomplete-but-grounded) as `partially_supported`.
- **Kimi is the better judge under this rubric.** OpenAI `gpt-4o-mini` is markedly lenient
  (51 `supported` of 72 verdicts; added-claim detection only 3/7; balanced accuracy 0.625 vs
  Kimi 0.792). It barely improves on Ragas faithfulness.
- **Very stable, but confidence is not calibrated.** Run-to-run verdict agreement is 0.986
  (Kimi) / 1.000 (OpenAI) with zero insufficient/missing results, so it is stable enough for
  diagnostic use. But mean confidence is essentially identical for correct and incorrect
  verdicts (~0.97 both), and inverted for OpenAI — confidence carries no usable signal.

## Recommendation

- **Diagnostic use: yes**, with the Kimi judge — as a second opinion that catches the
  added-claim / wrong-number answers Ragas faithfulness waves through. Useful for triage and
  for auditing the faithfulness metric's leniency.
- **Regression gate: no.** It misses the exact relational-inversion cases it targets (0/2),
  it introduces false negatives on grounded-but-non-responsive answers, and its confidence is
  uncalibrated. It is not reliable enough, on this evidence, to fail a build.
- **Remaining failure modes:** causal-direction inversions still slip through; responsiveness
  leaks into the grounding verdict on mismatched question/answer pairs; self-reported
  confidence is uninformative; OpenAI leniency. Sharpening the rubric to force clause-level
  causal-direction checking (and re-affirm grounding≠responsiveness), then re-running, is the
  obvious next experiment — deferred here because it needs another paid run.

---

## Measured report

Generated 20260722T093117Z · 24 cases · 3 replicates/judge · judges: kimi, openai

Experimental, diagnostic evaluator. It asks one judge, in a single structured call, whether the COMPLETE MEANING of an answer is supported by the retrieved contexts — a question Ragas faithfulness cannot ask, because decomposing an answer into independently-supported statements is blind to reversed causality and other relational errors. No gate is added; Ragas faithfulness is unchanged.

Grounded correctness is reported separately from responsiveness. This evaluator judges grounding only; a grounded but non-responsive answer is still grounded.

## Case distribution

- **faithfulness** — `faithful` 12, `unfaithful` 12
- **quality** — `non_responsive` 3, `partially_responsive` 3, `responsive` 18
- **mutation** — `append_claim` 3, `combine` 3, `drop_sentence` 3, `evade_request` 1, `fabricate` 1, `identity` 6, `replace_number` 3, `reverse_causal` 2, `swap_question` 2
- **doc** — `attention` 10, `ddia` 9, `product_analytics` 5

## Agreement with binary human labels

Positive class: `faithful` (verdict `supported`). `partially_supported` and `unsupported` both map to `unfaithful` per the label contract. Prediction = the per-case majority verdict across replicates; cases with fewer than two usable verdicts are excluded as insufficient data.

| judge | pos | neg | pos recall | neg recall | FPR | FNR | balanced acc | insufficient | missing-result rate |
|---|---|---|---|---|---|---|---|---|---|
| `kimi` | 12 | 12 | 0.7500 | 0.8333 | 0.1667 | 0.2500 | 0.7917 | 0 | 0.0000 |
| `openai` | 12 | 12 | 0.8333 | 0.4167 | 0.5833 | 0.1667 | 0.6250 | 0 | 0.0000 |

Negative recall is the headline: it is the share of genuinely unfaithful answers the evaluator caught. A high false-positive rate means unfaithful answers were waved through.

## Relational-failure detection

Detection = the mutated (unfaithful) case was predicted unfaithful. Denominator excludes cases left insufficient.

| judge | relational inversion | wrong number | added claim |
|---|---|---|---|
| `kimi` | 0/2 | 3/3 | 7/7 |
| `openai` | 0/2 | 2/3 | 3/7 |

The two `reverse_causal` cases are the exact blind spot documented for Ragas faithfulness on this set: same words, opposite direction of causation.

## Verdict distribution and partial support

Partial support is reported separately: it maps to unfaithful, but a judge that leans on it behaves differently from one that commits to `unsupported`.

| judge | supported | partially_supported | unsupported | insufficient_data |
|---|---|---|---|---|
| `kimi` | 33 | 26 | 13 | 0 |
| `openai` | 51 | 9 | 12 | 0 |

## Stability and confidence calibration

| judge | run-to-run verdict agreement | unanimous cases | mean confidence (correct) | mean confidence (incorrect) |
|---|---|---|---|---|
| `kimi` | 0.9861 | 23 | 0.9754 | 0.9733 |
| `openai` | 1.0000 | 24 | 0.9511 | 0.9778 |

Run-to-run verdict agreement is the modal-verdict share across replicates. A well-calibrated judge is more confident when it is right than when it is wrong.

## Comparison with retained Ragas faithfulness

Same 24 cases, same judges. Ragas faithfulness thresholded at 0.5 on its retained observations; relational evaluator uses the majority verdict.

| judge | metric | neg recall (catches unfaithful) | FPR (waves through) | balanced acc |
|---|---|---|---|---|
| `kimi` | relational | 0.833 | 0.167 | 0.792 |
| `kimi` | ragas faithfulness (24 cases) | 0.083 | 0.917 | 0.542 |
| `openai` | relational | 0.417 | 0.583 | 0.625 |
| `openai` | ragas faithfulness (24 cases) | 0.167 | 0.833 | 0.583 |

## Assessment

- `kimi`: relational inversions detected 0/2; negative recall 0.8333; balanced accuracy 0.7917; run-to-run agreement 0.9861; missing-result rate 0.0000.
- `openai`: relational inversions detected 0/2; negative recall 0.4167; balanced accuracy 0.6250; run-to-run agreement 1.0000; missing-result rate 0.0000.

Read against the questions this set exists to answer: does it detect both relational inversions; does it reduce false positives on unfaithful answers versus Ragas faithfulness; does it preserve recall on faithful answers; which judge is better; is it stable enough for diagnostic use; is it strong enough for a regression gate. The numeric answers are in the tables above.

## Methodological limitations

Small sample (24 cases), selected to cover known failure modes rather than sampled to estimate production prevalence, so confidence intervals would overstate what it establishes. This is exploratory, not held-out validation.

Insufficient-data and missing-result accounting is reported alongside every recall so a judge that mostly failed to return a usable verdict cannot read as accurate. Missing replicates are excluded from the confusion matrix, not silently treated as a classification.

A single call is a single sample of a stochastic judge; the Kimi judge cannot be pinned below temperature 0.6, so its run-to-run verdict agreement is the ceiling on how reproducible any single verdict is. Grounded correctness stays separate from responsiveness; a topical but fabricated answer is caught here, an accurate but non-responsive answer is not penalised for grounding.

## Per-case detail

| case | doc:row | mutation | expected faith | kimi | openai |
|---|---|---|---|---|---|
| 1 | `ddia:12` | identity | faithful | supported (1.00) | supported (1.00) |
| 2 | `ddia:8` | identity | faithful | supported (1.00) | supported (1.00) |
| 3 | `attention:18` | identity | faithful | supported (1.00) | supported (1.00) |
| 4 | `attention:2` | identity | faithful | supported (1.00) | supported (1.00) |
| 5 | `product_analytics:19` | identity | faithful | supported (1.00) | supported (1.00) |
| 6 | `product_analytics:28` | identity | faithful | supported (1.00) | supported (1.00) |
| 7 | `ddia:15` | append_claim | unfaithful | partially_supported (0.95) | partially_supported (0.80) |
| 8 | `ddia:25` | combine | unfaithful | partially_supported (0.95) | partially_supported (0.80) |
| 9 | `attention:6` | append_claim | unfaithful | partially_supported (0.95) | supported (1.00) |
| 10 | `attention:15` | combine | unfaithful | partially_supported (0.92) | supported (1.00) |
| 11 | `product_analytics:22` | append_claim | unfaithful | partially_supported (0.95) | supported (1.00) |
| 12 | `product_analytics:30` | combine | unfaithful | partially_supported (0.95) | supported (1.00) |
| 13 | `ddia:3` | replace_number | unfaithful | partially_supported (0.92) | supported (1.00) |
| 14 | `attention:24` | replace_number | unfaithful | partially_supported (0.95) | unsupported (0.90) |
| 15 | `attention:2` | replace_number | unfaithful | unsupported (1.00) | partially_supported (0.87) |
| 16 | `ddia:9` | reverse_causal | unfaithful | supported (0.98) | supported (1.00) |
| 17 | `attention:22` | reverse_causal | unfaithful | supported (1.00) | supported (1.00) |
| 18 | `product_analytics:6` | fabricate | unfaithful | unsupported (1.00) | unsupported (0.90) |
| 19 | `ddia:16` | drop_sentence | faithful | supported (1.00) | supported (1.00) |
| 20 | `attention:17` | drop_sentence | faithful | partially_supported (0.88) | supported (1.00) |
| 21 | `ddia:29` | drop_sentence | faithful | supported (1.00) | supported (1.00) |
| 22 | `ddia:20` | swap_question | faithful | unsupported (1.00) | unsupported (0.90) |
| 23 | `attention:10` | swap_question | faithful | unsupported (1.00) | unsupported (0.90) |
| 24 | `attention:18` | evade_request | faithful | supported (1.00) | supported (1.00) |

Raw observations: 144 individual verdicts.
