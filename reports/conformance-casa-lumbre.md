# web4 conformance: casa-lumbre

| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |
|---|---|---|---|---|---|---|---|---|---|
| rules | 164 | 987 | 0 | 1 | 100.0% | 1 ms | 1 ms | 0 | $0.00000 |
| jev-1.13.0 | 164 | 2961 | 0 | 3 | 100.0% | 278 ms | 346 ms | 6664 | $0.00028 |

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
| A.relevance | english | 1656 | 100.0% | 0.71 | 0.00 | `   ▂▂▅▃▂▅█` / `          ` | 3.4% | 0.080 |
| A.salience | english | 531 | 100.0% | 0.60 | 0.00 | `  ▅▄▂▂▆█▄▂` / `          ` | 7.9% | 0.223 |
| B.component | english | 303 | 91.4% | 0.57 | 0.13 | `▂▁▂▁▂▅█▆▄ ` / `█▆▄▁      ` | 2.9% | 0.140 |
| C.region | english | 471 | 92.6% | 0.46 | 0.19 | ` ▃▂▅▇█▆▁  ` / `▂██▁      ` | 10.8% | 0.217 |
