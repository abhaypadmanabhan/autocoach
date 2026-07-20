# Ragas judge calibration

Generated 20260720T072027Z · 3 replicates/judge · 6 rows · judges: kimi, openai

Retrieval and answer generation are held fixed — every score below was produced by replaying already-saved rows, so all observed variation is judge variation.

## Judges

| judge | model | temperature | deterministic | note |
|---|---|---|---|---|
| `kimi` | `kimi-k2.6` | 0.6 | no | Moonshot rejects any temperature but 0.6 on this model. |
| `openai` | `gpt-4o-mini` | 0.0 | yes | temperature=0, seed=0 (best-effort reproducibility). |

## Rows under test

| row | concept | baseline CSV |
|---|---|---|
| `product_analytics:20` | tracking plan | `product_analytics_20260711T045032Z.csv` |
| `product_analytics:3` | product analytics | `product_analytics_20260711T045032Z.csv` |
| `ddia:26` | synchronous replication | `ddia_20260711T044804Z.csv` |
| `ddia:3` | hardware faults | `ddia_20260711T044804Z.csv` |
| `attention:7` | transformer novelty | `attention_20260711T044556Z.csv` |
| `attention:19` | why self-attention | `attention_20260711T044556Z.csv` |

## Stability by metric and judge

| metric | judge | rows | rows that moved | max range | mean range | mean stdev | verdict |
|---|---|---|---|---|---|---|---|
| faithfulness | `kimi` | 6 | 1/6 | 0.300 | 0.050 | 0.029 | UNSTABLE |
| faithfulness | `openai` | 6 | 2/6 | 0.667 | 0.153 | 0.088 | UNSTABLE |
| answer_relevancy | `kimi` | 6 | 6/6 | 0.037 | 0.016 | 0.009 | NEAR-STABLE |
| answer_relevancy | `openai` | 6 | 4/6 | 0.055 | 0.010 | 0.005 | NOISY |
| context_precision | `kimi` | 6 | 0/6 | 0.000 | 0.000 | 0.000 | STABLE |
| context_precision | `openai` | 6 | 0/6 | 0.000 | 0.000 | 0.000 | STABLE |
| context_recall | `kimi` | 6 | 0/6 | 0.000 | 0.000 | 0.000 | STABLE |
| context_recall | `openai` | 6 | 0/6 | 0.000 | 0.000 | 0.000 | STABLE |

## Per-row detail

| metric | row | judge | n | mean | stdev | min | max | range |
|---|---|---|---|---|---|---|---|---|
| answer_relevancy | `attention:7` | `kimi` | 3 | 0.497 | 0.021 | 0.484 | 0.521 | 0.037 |
| answer_relevancy | `attention:7` | `openai` | 3 | 0.745 | 0.000 | 0.745 | 0.745 | 0.000 |
| answer_relevancy | `attention:19` | `kimi` | 3 | 0.547 | 0.004 | 0.545 | 0.552 | 0.007 |
| answer_relevancy | `attention:19` | `openai` | 3 | 0.484 | 0.028 | 0.456 | 0.512 | 0.055 |
| answer_relevancy | `ddia:3` | `kimi` | 3 | 0.874 | 0.009 | 0.864 | 0.880 | 0.016 |
| answer_relevancy | `ddia:3` | `openai` | 3 | 0.886 | 0.002 | 0.885 | 0.888 | 0.003 |
| answer_relevancy | `ddia:26` | `kimi` | 3 | 0.823 | 0.006 | 0.817 | 0.829 | 0.012 |
| answer_relevancy | `ddia:26` | `openai` | 3 | 0.817 | 0.000 | 0.817 | 0.817 | 0.000 |
| answer_relevancy | `product_analytics:3` | `kimi` | 3 | 0.938 | 0.012 | 0.928 | 0.951 | 0.023 |
| answer_relevancy | `product_analytics:3` | `openai` | 3 | 0.932 | 0.000 | 0.932 | 0.932 | 0.000 |
| answer_relevancy | `product_analytics:20` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| answer_relevancy | `product_analytics:20` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `attention:7` | `kimi` | 3 | 0.917 | 0.000 | 0.917 | 0.917 | 0.000 |
| context_precision | `attention:7` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `attention:19` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `attention:19` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `ddia:3` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `ddia:3` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `ddia:26` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `ddia:26` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `product_analytics:3` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `product_analytics:3` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `product_analytics:20` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_precision | `product_analytics:20` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `attention:7` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `attention:7` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `attention:19` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `attention:19` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `ddia:3` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `ddia:3` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `ddia:26` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `ddia:26` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `product_analytics:3` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `product_analytics:3` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `product_analytics:20` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| context_recall | `product_analytics:20` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| faithfulness | `attention:7` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| faithfulness | `attention:7` | `openai` | 3 | 0.583 | 0.144 | 0.500 | 0.750 | 0.250 |
| faithfulness | `attention:19` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| faithfulness | `attention:19` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| faithfulness | `ddia:3` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| faithfulness | `ddia:3` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| faithfulness | `ddia:26` | `kimi` | 3 | 0.300 | 0.173 | 0.200 | 0.500 | 0.300 |
| faithfulness | `ddia:26` | `openai` | 3 | 0.556 | 0.385 | 0.333 | 1.000 | 0.667 |
| faithfulness | `product_analytics:3` | `kimi` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| faithfulness | `product_analytics:3` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| faithfulness | `product_analytics:20` | `kimi` | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| faithfulness | `product_analytics:20` | `openai` | 3 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |

## Agreement with manual inspection (faithfulness)

Every calibration row was hand-checked: each answer's claims are all supported by its retrieved contexts, so the human expectation is 1.000. See `calibration_labels.json`.

| judge | rows labelled | mean abs error | max abs error |
|---|---|---|---|
| `kimi` | 6 | 0.283 | 1.000 |
| `openai` | 6 | 0.144 | 0.444 |

## Noise band

Largest range observed on identical input — a score change smaller than this is not evidence of a regression.

| metric | judge | treat as noise below |
|---|---|---|
| faithfulness | `kimi` | ±0.300 |
| faithfulness | `openai` | ±0.667 |
| answer_relevancy | `kimi` | ±0.037 |
| answer_relevancy | `openai` | ±0.055 |
| context_precision | `kimi` | ±0.000 |
| context_precision | `openai` | ±0.000 |
| context_recall | `kimi` | ±0.000 |
| context_recall | `openai` | ±0.000 |

## Gate recommendation

A metric is gate-eligible when its worst observed range stays at or below 0.05 on identical input.

**Eligibility here is repeatability only.** A metric that returns the same number every time is safe to gate on *mechanically*, which is not the same as that number being right. Pair this table with the agreement section above before promoting any metric to a gate: a stable metric that disagrees with manual inspection is a reliably wrong gate.

| metric | judge | max range | gate-eligible |
|---|---|---|---|
| faithfulness | `kimi` | 0.300 | no — diagnostic only |
| faithfulness | `openai` | 0.667 | no — diagnostic only |
| answer_relevancy | `kimi` | 0.037 | yes |
| answer_relevancy | `openai` | 0.055 | no — diagnostic only |
| context_precision | `kimi` | 0.000 | yes |
| context_precision | `openai` | 0.000 | yes |
| context_recall | `kimi` | 0.000 | yes |
| context_recall | `openai` | 0.000 | yes |

Raw observations: 144 individual scores.
