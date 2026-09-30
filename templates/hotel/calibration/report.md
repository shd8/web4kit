# web4 conformance: casa-ribeira

| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |
|---|---|---|---|---|---|---|---|---|---|
| rules | 105 | 494 | 0 | 1 | 100.0% | 1 ms | 2 ms | 0 | $0.00000 |
| jev-1.13.0 | 105 | 1482 | 0 | 3 | 100.0% | 283 ms | 350 ms | 8052 | $0.00034 |

## rules

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 462 | 100.0% | 1.00 | 0.00 | `         █` / `          ` | – | n/a (rules) |
| B.component | english | 32 | 100.0% | 1.00 | 0.00 | `         █` / `          ` | – | n/a (rules) |

## jev-1.13.0

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 1386 | 100.0% | 0.88 | 0.00 | `       ▁▃█` / `          ` | 1.0% | 0.560 |
| B.component | english | 96 | 100.0% | 0.95 | 0.00 | `       ▁▁█` / `          ` | 3.9% | 0.600 |
