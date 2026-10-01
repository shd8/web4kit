# web4 conformance: my-web4-site

| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |
|---|---|---|---|---|---|---|---|---|---|
| rules | 27 | 108 | 0 | 1 | 100.0% | 0 ms | 2 ms | 0 | $0.00000 |
| jev-1.13.0 | 27 | 324 | 0 | 3 | 100.0% | 269 ms | 348 ms | 4058 | $0.00017 |

## rules

| kind | language | samples | accuracy | decision accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 108 | 100.0% | 100.0% | 1.00 | 0.00 | `         █` / `          ` | – | n/a (rules) |

Decision accuracy scores the labels against the final page (after gating, defaults, invariants and fallbacks).

## jev-1.13.0

| kind | language | samples | accuracy | decision accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 324 | 100.0% | 100.0% | 0.73 | 0.00 | `    ▂▆▅▃▇█` / `          ` | 3.7% | 0.400 |

Decision accuracy scores the labels against the final page (after gating, defaults, invariants and fallbacks).
