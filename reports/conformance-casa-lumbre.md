# web4 conformance: casa-lumbre

| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |
|---|---|---|---|---|---|---|---|---|---|
| rules | 164 | 987 | 0 | 1 | 100.0% | 1 ms | 1 ms | 0 | $0.00000 |
| jev-1.13.0 | 164 | 2961 | 0 | 3 | 100.0% | 271 ms | 341 ms | 6795 | $0.00029 |

## rules

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 552 | 94.9% | 1.00 | 1.00 | `         █` / `         █` | – | n/a (rules) |
| A.salience | english | 177 | 100.0% | 1.00 | 0.00 | `         █` / `          ` | – | n/a (rules) |
| B.component | english | 101 | 94.1% | 1.00 | 1.00 | `         █` / `         █` | – | n/a (rules) |
| C.region | english | 157 | 70.7% | 1.00 | 1.00 | `         █` / `         █` | – | n/a (rules) |

## jev-1.13.0

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 1656 | 99.9% | 0.72 | 0.02 | `   ▂▂▅▃▂▅█` / `█         ` | 2.6% | 0.020 |
| A.salience | english | 531 | 100.0% | 0.62 | 0.00 | `  ▄▄▂▂▆█▆▃` / `          ` | 7.8% | 0.223 |
| B.component | english | 303 | 91.7% | 0.57 | 0.10 | `▂▂▁▁▂▄█▇▃ ` / `█▃▁▁      ` | 2.9% | 0.080 |
| C.region | english | 471 | 92.8% | 0.46 | 0.17 | ` ▃▂▅██▆▁  ` / `▁█▅       ` | 10.0% | 0.213 |
