# web4 conformance: my-web4-site

| engine | fixtures | labelled answers | engine failures | repeats | invariant pass | p50 latency | p95 latency | tokens / plan | cost / plan |
|---|---|---|---|---|---|---|---|---|---|
| rules | 27 | 108 | 0 | 1 | 100.0% | 1 ms | 1 ms | 0 | $0.00000 |
| laya-onnx@68f27dfe5a27 | 27 | 108 | 0 | 1 | 97.7% | 32420 ms | 32757 ms | 3869 | $0.00000 |

## rules

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 108 | 100.0% | 1.00 | 0.00 | `         █` / `          ` | – | n/a (rules) |

## laya-onnx@68f27dfe5a27

| kind | language | samples | accuracy | mean conf (correct) | mean conf (incorrect) | conf histogram correct / incorrect | flip rate | threshold |
|---|---|---|---|---|---|---|---|---|
| A.relevance | english | 108 | 64.8% | 0.45 | 0.36 | `▁▂▃█▄▄▁▂▃ ` / `▁▂▃▅█▃    ` | – | 0.537 |

Invariant failures:

- `from-instagram`: from-social missing
- `night-owl`: late-night missing
