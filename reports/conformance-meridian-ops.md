# web4 conformance: meridian-ops

| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |
|---|---|---|---|---|---|---|---|---|---|
| rules | 113 | 290 | 0 | 1 | 100.0% | 1 ms | 2 ms | 0 | $0.00000 |
| jev-1.13.0 | 113 | 870 | 0 | 3 | 100.0% | 278 ms | 354 ms | 7302 | $0.00031 |

## rules

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 290 | 55.9% | 1.00 | 1.00 | `         █` / `         █` | – | n/a (rules) |

## jev-1.13.0

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 870 | 96.1% | 0.77 | 0.11 | `▁    ▂▃▄▇█` / `██▂       ` | 2.2% | 0.000 |
