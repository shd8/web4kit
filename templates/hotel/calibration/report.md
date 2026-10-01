# web4 conformance: casa-ribeira

| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |
|---|---|---|---|---|---|---|---|---|---|
| rules | 105 | 447 | 0 | 1 | 100.0% | 1 ms | 1 ms | 0 | $0.00000 |
| jev-1.13.0 | 105 | 1341 | 0 | 3 | 100.0% | 281 ms | 356 ms | 7671 | $0.00032 |

## rules

| kind | language | samples | accuracy | decision accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 415 | 100.0% | 100.0% | 1.00 | 0.00 | `         █` / `          ` | – | n/a (rules) |
| B.component | english | 32 | 100.0% | 100.0% | 1.00 | 0.00 | `         █` / `          ` | – | n/a (rules) |

Decision accuracy scores the labels against the final page (after gating, defaults, invariants and fallbacks).

## jev-1.13.0

| kind | language | samples | accuracy | decision accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 1245 | 100.0% | 100.0% | 0.89 | 0.00 | `        ▃█` / `          ` | 0.9% | 0.520 |
| B.component | english | 96 | 100.0% | 100.0% | 0.95 | 0.00 | `      ▁ ▁█` / `          ` | 4.9% | 0.600 |

Decision accuracy scores the labels against the final page (after gating, defaults, invariants and fallbacks).
