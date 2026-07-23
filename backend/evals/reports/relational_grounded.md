# Relation-aware grounded correctness — comparison report

Experimental, diagnostic evaluator (`evals/relational_eval.py` + `evals/relational_agreement.py`).
Scored all 24 balanced calibration cases with both judges (Kimi, OpenAI) at 3 replicates
(144 single structured calls; 72 repeated measurements per judge, not 72 independent
examples), then compared against the retained Ragas faithfulness observations. Exact
`(document, case_id)` parity was verified for all 24 cases and the shared source hashes
materialise successfully from the committed case registry. **No gate is added; Ragas
faithfulness and the default
judge are unchanged.** This report carries identifiers, labels, and numbers only — never
questions, answers, or contexts.

## Findings (honest read)

- **Observed gain on this benchmark for added claims and wrong numbers.** Kimi detected 7/7
  appended/combined/fabricated cases and 3/3 wrong-number cases. Across all 12 unfaithful
  cases, its detection rate was **10/12 (0.833)** versus **1/12 (0.083)** for retained Ragas
  faithfulness; balanced accuracy was **0.792** versus **0.542**. These counts are limited to
  this deliberately selected 24-case benchmark.
- **No observed gain on the relational inversions it was built for — 0/2, both judges.** Both
  `reverse_causal` cases returned `supported` on all six replicates from both judges. The
  reversed answers are genuine causal inversions (verified against the human rationale), but
  the saved verdicts do not expose why the judges accepted them. The pattern is consistent
  with a hypothesised failure to preserve causal direction; it is not proof of an internal
  mechanism.
- **Faithful-case rejections are not limited to `swap_question`.** Both `swap_question`
  cases (grounded but paired with a neighbour's question → non-responsive, labelled *faithful*)
  were marked `unsupported` by both judges. This is consistent with hypothesised
  responsiveness leakage, but the verdict fields alone do not prove why. Kimi also rejected
  case 20, a faithful `drop_sentence` case, as `partially_supported` in all three replicates.
- **Kimi performed better only on this benchmark.** Kimi balanced accuracy was 0.792
  (19/24 correct) versus OpenAI `gpt-4o-mini` at 0.625 (15/24 correct). OpenAI produced
  `supported` on 51/72 repeated calls and detected 3/7 added-claim-family cases.
- **High agreement shows repeatability, not validity.** Modal-verdict agreement across
  repeats was 0.986 (Kimi) and 1.000 (OpenAI), with 0/144 insufficient calls. Both judges
  were unanimous on both missed causal-inversion cases, so agreement cannot be read as
  evidence that the verdicts are valid. Self-reported confidence also failed to separate
  correct from incorrect case predictions on this set.

## Recommendation

- **Diagnostic use: limited**, with the Kimi judge as a second signal. On this benchmark it
  detected 10/12 unfaithful cases, including 7/7 added-claim-family and 3/3 wrong-number
  cases, while rejecting 3/12 faithful cases.
- **Regression gate: no.** It misses the exact relational-inversion cases it targets (0/2),
  it introduces false negatives on grounded-but-non-responsive answers, and its confidence is
  uncalibrated. It is not reliable enough, on this evidence, to fail a build.
- **Remaining observed failure modes:** both causal-direction inversions were missed; both
  `swap_question` cases were rejected by both judges; Kimi rejected one faithful
  `drop_sentence` case; confidence was not discriminative. Any rubric change and paid
  follow-up experiment remain out of scope for this review.

---

## Measured report

Generated 20260722T093117Z · 24 cases · 3 replicates/judge · judges: kimi, openai

Each judge produced 72 repeated verdicts: 3 measurements of each of 24 cases, not 72 independent benchmark examples.

Experimental, diagnostic evaluator. It asks one judge, in a single structured call, whether the COMPLETE MEANING of an answer is supported by the retrieved contexts. On this benchmark, Ragas faithfulness missed both tested causal inversions; statement-level decomposition can miss a wrong relationship even when component facts are supported. No gate is added; Ragas faithfulness is unchanged.

Grounded correctness is reported separately from responsiveness. This evaluator judges grounding only; a grounded but non-responsive answer is still grounded.

## Case distribution

- **faithfulness** — `faithful` 12, `unfaithful` 12
- **quality** — `non_responsive` 3, `partially_responsive` 3, `responsive` 18
- **mutation** — `append_claim` 3, `combine` 3, `drop_sentence` 3, `evade_request` 1, `fabricate` 1, `identity` 6, `replace_number` 3, `reverse_causal` 2, `swap_question` 2
- **doc** — `attention` 10, `ddia` 9, `product_analytics` 5

## Comparison with binary human labels

Positive class: `faithful` (verdict `supported`). `partially_supported` and `unsupported` both map to `unfaithful` per the label contract. Prediction = the per-case majority verdict across replicates; cases with fewer than two usable verdicts are excluded as insufficient data.

| judge | faithful accepted | faithful rejected | unfaithful detected | unfaithful missed |
|---|---|---|---|---|
| `kimi` | 9 | 3 | 10 | 2 |
| `openai` | 10 | 2 | 5 | 7 |

| judge | faithful acceptance rate | faithful rejection rate | unfaithful detection rate | unfaithful miss rate | balanced accuracy | insufficient cases | missing-call rate |
|---|---|---|---|---|---|---|---|
| `kimi` | 0.7500 | 0.2500 | 0.8333 | 0.1667 | 0.7917 | 0 | 0.0000 |
| `openai` | 0.8333 | 0.1667 | 0.4167 | 0.5833 | 0.6250 | 0 | 0.0000 |

Rate formulas: faithful acceptance = accepted faithful / all faithful; faithful rejection = rejected faithful / all faithful; unfaithful detection = detected unfaithful / all unfaithful; unfaithful miss = missed unfaithful / all unfaithful. Balanced accuracy is the mean of faithful acceptance and unfaithful detection.

## Relational-failure detection

Detection = the mutated (unfaithful) case was predicted unfaithful. Denominator excludes cases left insufficient.

| judge | relational inversion | wrong number | added claim |
|---|---|---|---|
| `kimi` | 0/2 | 3/3 | 7/7 |
| `openai` | 0/2 | 2/3 | 3/7 |

The two `reverse_causal` cases are the exact blind spot documented for Ragas faithfulness on this set: same words, opposite direction of causation.

## Family-level case counts

| family | cases | judge | predicted unfaithful | predicted faithful | excluded |
|---|---|---|---|---|---|
| append_claim | 3 | `kimi` | 3 | 0 | 0 |
| append_claim | 3 | `openai` | 1 | 2 | 0 |
| combine | 3 | `kimi` | 3 | 0 | 0 |
| combine | 3 | `openai` | 1 | 2 | 0 |
| drop_sentence | 3 | `kimi` | 1 | 2 | 0 |
| drop_sentence | 3 | `openai` | 0 | 3 | 0 |
| evade_request | 1 | `kimi` | 0 | 1 | 0 |
| evade_request | 1 | `openai` | 0 | 1 | 0 |
| fabricate | 1 | `kimi` | 1 | 0 | 0 |
| fabricate | 1 | `openai` | 1 | 0 | 0 |
| identity | 6 | `kimi` | 0 | 6 | 0 |
| identity | 6 | `openai` | 0 | 6 | 0 |
| replace_number | 3 | `kimi` | 3 | 0 | 0 |
| replace_number | 3 | `openai` | 2 | 1 | 0 |
| reverse_causal | 2 | `kimi` | 0 | 2 | 0 |
| reverse_causal | 2 | `openai` | 0 | 2 | 0 |
| swap_question | 2 | `kimi` | 2 | 0 | 0 |
| swap_question | 2 | `openai` | 2 | 0 | 0 |

## Faithful cases rejected

These are identified from saved structured verdicts and case labels. The table locates the errors; it does not establish the judge's internal reason for them.

| judge | case | doc | family | modal verdict |
|---|---|---|---|---|
| `kimi` | 20 | `attention` | drop_sentence | partially_supported |
| `kimi` | 22 | `ddia` | swap_question | unsupported |
| `kimi` | 23 | `attention` | swap_question | unsupported |
| `openai` | 22 | `ddia` | swap_question | unsupported |
| `openai` | 23 | `attention` | swap_question | unsupported |

## Original verdicts and collapsed binary calls

The first table preserves the original three-class verdicts over repeated calls. The second applies the binary mapping to those same calls. These call counts describe repeatability and verdict tendency; the confusion tables above use one majority prediction per case.

| judge | supported | partially_supported | unsupported | insufficient_data |
|---|---|---|---|---|
| `kimi` | 33 | 26 | 13 | 0 |
| `openai` | 51 | 9 | 12 | 0 |

| judge | collapsed faithful | collapsed unfaithful | excluded |
|---|---|---|---|
| `kimi` | 33 | 39 | 0 |
| `openai` | 51 | 21 | 0 |

## Stability and confidence calibration

| judge | run-to-run verdict agreement | unanimous cases | mean confidence (correct) | mean confidence (incorrect) |
|---|---|---|---|---|
| `kimi` | 0.9861 | 23 | 0.9754 | 0.9733 |
| `openai` | 1.0000 | 24 | 0.9511 | 0.9778 |

Run-to-run verdict agreement is the modal-verdict share across replicates. It measures repeatability on these cases, not validity. A well-calibrated judge is more confident when it is right than when it is wrong.

## Comparison with retained Ragas faithfulness

Exact composite-key parity was required for all 24 `(document, case_id)` records for each judge; attribution never falls back to case ID alone. Source question/answer hashes are validated when the shared case registry is materialised. Ragas faithfulness is thresholded at 0.5 on retained observations; the relational evaluator uses the per-case majority verdict.

| judge | metric | faithful acceptance rate | faithful rejection rate | unfaithful detection rate | unfaithful miss rate | balanced accuracy |
|---|---|---|---|---|---|---|
| `kimi` | relational | 0.750 | 0.250 | 0.833 | 0.167 | 0.792 |
| `kimi` | ragas faithfulness (24 cases) | 1.000 | 0.000 | 0.083 | 0.917 | 0.542 |
| `openai` | relational | 0.833 | 0.167 | 0.417 | 0.583 | 0.625 |
| `openai` | ragas faithfulness (24 cases) | 1.000 | 0.000 | 0.167 | 0.833 | 0.583 |

## Assessment

- `kimi`: relational inversions detected 0/2; unfaithful detection rate 0.8333; balanced accuracy 0.7917; run-to-run agreement 0.9861; missing-result rate 0.0000.
- `openai`: relational inversions detected 0/2; unfaithful detection rate 0.4167; balanced accuracy 0.6250; run-to-run agreement 1.0000; missing-result rate 0.0000.

Read against the questions this set exists to answer: does it detect both relational inversions; does it reduce misses on unfaithful answers versus Ragas faithfulness; does it preserve recall on faithful answers; which judge performs better on this benchmark; is it repeatable enough for diagnostic use; is it strong enough for a regression gate. The numeric answers are in the tables above.

## Methodological limitations

Small sample (24 cases), selected to cover known failure modes rather than sampled to estimate production prevalence, so confidence intervals would overstate what it establishes. This is exploratory, not held-out validation.

Insufficient-data and missing-result accounting is reported alongside every recall so a judge that mostly failed to return a usable verdict cannot read as accurate. Missing replicates are excluded from the confusion matrix, not silently treated as a classification.

The 3 replicates are repeated measurements of the same 24 cases, not 72 independent benchmark examples per judge. A single call is one sample of a stochastic judge; the Kimi judge cannot be pinned below temperature 0.6, so run-to-run verdict agreement describes repeatability only and does not validate the verdicts. Grounded correctness stays separate from responsiveness; a topical but fabricated answer is caught here, an accurate but non-responsive answer is not penalised for grounding.

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

Raw observations: 144 repeated verdicts over 24 cases.
