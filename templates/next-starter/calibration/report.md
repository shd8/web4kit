# web4 conformance: casa-ribeira

| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |
|---|---|---|---|---|---|---|---|---|---|
| rules | 80 | 371 | 0 | 1 | 100.0% | 1 ms | 2 ms | 0 | $0.00000 |
| jev-1.13.0 | 80 | 1113 | 0 | 3 | 100.0% | 303 ms | 387 ms | 7665 | $0.00032 |

## rules

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 348 | 95.7% | 1.00 | 1.00 | `         █` / `         █` | – | n/a (rules) |
| B.component | english | 23 | 100.0% | 1.00 | 0.00 | `         █` / `          ` | – | n/a (rules) |

## jev-1.13.0

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 1044 | 99.8% | 0.80 | 0.02 | `   ▁▁▁▁▁▅█` / `█         ` | 0.8% | 0.000 |
| B.component | english | 69 | 100.0% | 0.94 | 0.00 | `       ▁▁█` / `          ` | 3.0% | 0.700 |
