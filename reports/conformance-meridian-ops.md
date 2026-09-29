# web4 conformance: meridian-ops

| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |
|---|---|---|---|---|---|---|---|---|---|
| rules | 113 | 290 | 0 | 1 | 100.0% | 0 ms | 1 ms | 0 | $0.00000 |
| jev-1.13.0 | 113 | 870 | 0 | 3 | 100.0% | 284 ms | 372 ms | 7251 | $0.00030 |

## rules

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 290 | 55.9% | 1.00 | 1.00 | `         █` / `         █` | – | n/a (rules) |

## jev-1.13.0

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 870 | 97.2% | 0.76 | 0.13 | ` ▁  ▁▁▃▄█▇` / `▇█▄       ` | 2.4% | 0.000 |
