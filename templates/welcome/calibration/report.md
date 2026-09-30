# web4 conformance: my-web4-site

| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |
|---|---|---|---|---|---|---|---|---|---|
| rules | 27 | 108 | 0 | 1 | 100.0% | 0 ms | 2 ms | 0 | $0.00000 |
| jev-1.13.0 | 27 | 324 | 0 | 3 | 100.0% | 257 ms | 322 ms | 4058 | $0.00017 |

## rules

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 108 | 100.0% | 1.00 | 0.00 | `         █` / `          ` | – | n/a (rules) |

## jev-1.13.0

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 324 | 100.0% | 0.73 | 0.00 | `    ▂▇▅▃▆█` / `          ` | 5.6% | 0.450 |
