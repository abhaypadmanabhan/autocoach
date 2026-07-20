# Judge agreement on balanced calibration cases

Generated 20260720T082202Z · 24 cases · 3 replicates/judge · judges: kimi, openai

Retrieval and generation are held fixed; every case is a deterministic mutation of a real pipeline answer scored against the contexts that answer was generated from. All variation below is judge variation.

## Case distribution

- **faithfulness** — `faithful` 12, `unfaithful` 12
- **quality** — `non_responsive` 3, `partially_responsive` 3, `responsive` 18
- **mutation** — `append_claim` 3, `combine` 3, `drop_sentence` 3, `evade_request` 1, `fabricate` 1, `identity` 6, `replace_number` 3, `reverse_causal` 2, `swap_question` 2
- **doc** — `attention` 10, `ddia` 9, `product_analytics` 5

## Agreement with human labels

Positive class: `faithful` for faithfulness, `responsive` for answer relevancy. `partially_responsive` cases are excluded from the relevancy matrix rather than forced onto a side. Threshold 0.5; predictions use each case's mean across replicates.

| metric | judge | pos | neg | TP | FN | TN | FP | pos recall | neg recall | FPR | FNR | balanced acc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| faithfulness | `kimi` | 12 | 12 | 12 | 0 | 1 | 11 | 1.000 | 0.083 | 0.917 | 0.000 | 0.542 |
| faithfulness | `openai` | 12 | 12 | 12 | 0 | 2 | 10 | 1.000 | 0.167 | 0.833 | 0.000 | 0.583 |
| answer_relevancy | `kimi` | 18 | 3 | 17 | 1 | 3 | 0 | 0.944 | 1.000 | 0.000 | 0.056 | 0.972 |
| answer_relevancy | `openai` | 18 | 3 | 17 | 1 | 3 | 0 | 0.944 | 1.000 | 0.000 | 0.056 | 0.972 |

Balanced accuracy of 0.500 is chance. A judge with a high false-positive rate is lenient: it waves through answers a human rejected.

## Stability and coverage

| metric | judge | replicates/row | mean range | max range | missing-score rate |
|---|---|---|---|---|---|
| faithfulness | `kimi` | 3 | 0.0271 | 0.3333 | 0.0000 |
| faithfulness | `openai` | 3 | 0.0010 | 0.0238 | 0.0000 |
| answer_relevancy | `kimi` | 3 | 0.0352 | 0.2259 | 0.0000 |
| answer_relevancy | `openai` | 3 | 0.0032 | 0.0528 | 0.0000 |

## Threshold sensitivity

Binary human labels versus a continuous score need a cutoff. If the verdict flips across this sweep, the headline number is an artefact of the cutoff.

| metric | judge | threshold | pos recall | neg recall | balanced acc |
|---|---|---|---|---|---|
| faithfulness | `kimi` | 0.3 | 1.000 | 0.083 | 0.542 |
| faithfulness | `kimi` | 0.5 | 1.000 | 0.083 | 0.542 |
| faithfulness | `kimi` | 0.6 | 1.000 | 0.250 | 0.625 |
| faithfulness | `kimi` | 0.7 | 1.000 | 0.417 | 0.708 |
| faithfulness | `kimi` | 0.8 | 1.000 | 0.583 | 0.792 |
| faithfulness | `kimi` | 0.9 | 0.917 | 0.833 | 0.875 |
| faithfulness | `kimi` | 0.95 | 0.917 | 0.833 | 0.875 |
| faithfulness | `kimi` | 0.999 | 0.917 | 0.833 | 0.875 |
| faithfulness | `openai` | 0.3 | 1.000 | 0.083 | 0.542 |
| faithfulness | `openai` | 0.5 | 1.000 | 0.167 | 0.583 |
| faithfulness | `openai` | 0.6 | 1.000 | 0.500 | 0.750 |
| faithfulness | `openai` | 0.7 | 0.917 | 0.500 | 0.708 |
| faithfulness | `openai` | 0.8 | 0.917 | 0.583 | 0.750 |
| faithfulness | `openai` | 0.9 | 0.833 | 0.833 | 0.833 |
| faithfulness | `openai` | 0.95 | 0.833 | 0.833 | 0.833 |
| faithfulness | `openai` | 0.999 | 0.833 | 0.833 | 0.833 |
| answer_relevancy | `kimi` | 0.3 | 1.000 | 1.000 | 1.000 |
| answer_relevancy | `kimi` | 0.5 | 0.944 | 1.000 | 0.972 |
| answer_relevancy | `kimi` | 0.6 | 0.944 | 1.000 | 0.972 |
| answer_relevancy | `kimi` | 0.7 | 0.944 | 1.000 | 0.972 |
| answer_relevancy | `kimi` | 0.8 | 0.833 | 1.000 | 0.917 |
| answer_relevancy | `kimi` | 0.9 | 0.389 | 1.000 | 0.694 |
| answer_relevancy | `kimi` | 0.95 | 0.389 | 1.000 | 0.694 |
| answer_relevancy | `kimi` | 0.999 | 0.111 | 1.000 | 0.556 |
| answer_relevancy | `openai` | 0.3 | 1.000 | 1.000 | 1.000 |
| answer_relevancy | `openai` | 0.5 | 0.944 | 1.000 | 0.972 |
| answer_relevancy | `openai` | 0.6 | 0.889 | 1.000 | 0.944 |
| answer_relevancy | `openai` | 0.7 | 0.889 | 1.000 | 0.944 |
| answer_relevancy | `openai` | 0.8 | 0.833 | 1.000 | 0.917 |
| answer_relevancy | `openai` | 0.9 | 0.500 | 1.000 | 0.750 |
| answer_relevancy | `openai` | 0.95 | 0.389 | 1.000 | 0.694 |
| answer_relevancy | `openai` | 0.999 | 0.056 | 1.000 | 0.528 |

### Best threshold observed

Chosen by looking at these same cases, so it is an optimistic estimate — a threshold picked on a set this small will not generalise unchanged. Read it as 'the metric can do this well', not as a value to deploy.

| metric | judge | best threshold | balanced acc |
|---|---|---|---|
| answer_relevancy | `kimi` | 0.3 | 1.000 |
| answer_relevancy | `openai` | 0.3 | 1.000 |
| faithfulness | `kimi` | 0.9 | 0.875 |
| faithfulness | `openai` | 0.9 | 0.833 |

## Per-case detail

| case | doc:row | mutation | expected faith | expected quality | faithfulness (kimi) | faithfulness (openai) | answer_relevancy (kimi) | answer_relevancy (openai) |
|---|---|---|---|---|---|---|---|---|
| 1 | `ddia:12` | identity | faithful | responsive | 1.000 | 1.000 | 1.000 | 0.845 |
| 2 | `ddia:8` | identity | faithful | responsive | 1.000 | 1.000 | 0.980 | 0.959 |
| 3 | `attention:18` | identity | faithful | responsive | 1.000 | 1.000 | 0.990 | 0.990 |
| 4 | `attention:2` | identity | faithful | responsive | 1.000 | 1.000 | 0.973 | 0.980 |
| 5 | `product_analytics:19` | identity | faithful | responsive | 1.000 | 1.000 | 1.000 | 1.000 |
| 6 | `product_analytics:28` | identity | faithful | responsive | 1.000 | 0.667 | 0.973 | 0.958 |
| 7 | `ddia:15` | append_claim | unfaithful | responsive | 0.750 | 0.750 | 0.714 | 0.845 |
| 8 | `ddia:25` | combine | unfaithful | responsive | 0.762 | 0.500 | 0.870 | 0.876 |
| 9 | `attention:6` | append_claim | unfaithful | responsive | 0.868 | 0.875 | 0.874 | 0.889 |
| 10 | `attention:15` | combine | unfaithful | responsive | 0.600 | 0.333 | 0.883 | 0.935 |
| 11 | `product_analytics:22` | append_claim | unfaithful | responsive | 0.857 | 0.841 | 0.872 | 0.872 |
| 12 | `product_analytics:30` | combine | unfaithful | responsive | 0.667 | 0.500 | 0.896 | 0.912 |
| 13 | `ddia:3` | replace_number | unfaithful | responsive | 0.500 | 0.500 | 0.873 | 0.884 |
| 14 | `attention:24` | replace_number | unfaithful | responsive | 0.800 | 0.833 | 0.812 | 0.765 |
| 15 | `attention:2` | replace_number | unfaithful | responsive | 0.500 | 0.500 | 0.969 | 0.980 |
| 16 | `ddia:9` | reverse_causal | unfaithful | responsive | 1.000 | 1.000 | 0.821 | 0.498 |
| 17 | `attention:22` | reverse_causal | unfaithful | responsive | 1.000 | 1.000 | 0.458 | 0.548 |
| 18 | `product_analytics:6` | fabricate | unfaithful | responsive | 0.000 | 0.000 | 0.757 | 0.964 |
| 19 | `ddia:16` | drop_sentence | faithful | partially_responsive | 1.000 | 1.000 | 0.723 | 0.817 |
| 20 | `attention:17` | drop_sentence | faithful | partially_responsive | 1.000 | 1.000 | 0.768 | 0.644 |
| 21 | `ddia:29` | drop_sentence | faithful | partially_responsive | 1.000 | 1.000 | 0.770 | 0.730 |
| 22 | `ddia:20` | swap_question | faithful | non_responsive | 1.000 | 1.000 | 0.142 | 0.142 |
| 23 | `attention:10` | swap_question | faithful | non_responsive | 1.000 | 0.800 | 0.203 | 0.248 |
| 24 | `attention:18` | evade_request | faithful | non_responsive | 0.889 | 1.000 | 0.212 | 0.229 |

Raw observations: 288 individual scores.
