# web4-bench

An open benchmark for **System One engines that plan web pages**. It holds every situation, question, label and invariant from web4's conformance suites, plus a scorer that measures an engine exactly as web4 does.

The challenge: **make a small open engine plan pages as well as Jev.**

## The challenge

An entry meets the challenge when both of these hold:

1. **It is a small open System One engine:** open weights, at most **2 GB** of weights, and able to answer offline on a laptop CPU.
2. **It matches or beats Jev on the test split:** its pooled **decision accuracy** and its **invariant pass rate** are each at least those of the best Jev entry on the leaderboard, at the same dataset version.

The leaderboard computes this from the entries' metadata and scores; nobody ticks it by hand.

Distillation is one route: ask Jev the dev-split questions with your own key (`pnpm bench run --engine jev`), then train a small model on its answers. **The dataset ships no Jev answers.** It has labels only, and anything you learn from Jev comes from your own requests under your own terms with TypeSafe.

## What's in it

`data/v1/` is generated from the fixtures by `pnpm bench export`, and CI checks that it stays current.

| file | contents |
|---|---|
| `dataset.json` | version, content hash (sha256 of the uncompressed data files), licence, splits and per-site counts |
| `<site>.items.jsonl.gz` | one item per line (below) |
| `<site>.manifests.json.gz` | the site's manifests as JSON, so the planning pipeline can be replayed. Data fetchers are dropped, because planning never fetches. |

| split | sites | items | labels |
|---|---|---|---|
| `dev` | restaurant (Casa Lumbre), explorer (Meridian Supply) | 277 | 1,277 |
| `test` | hotel (Casa Ribeira), welcome starter | 132 | 602 |

The test split is held out by site: an engine is measured on sites it wasn't tuned on. **Its labels are public. Training on them, or tuning against test scores, disqualifies an entry.** Declare your training data in the submission metadata.

### An item

```jsonc
{
  "id": "hotel/arriving-today",
  "site": "hotel",
  "split": "test",
  "state": { … },                        // send as is
  "questions": {                          // send as is: System One wire format, nothing web4-only
    "A.relevance:rooms": { "type": "noul", "instructions": { … } },
    "B.component:rooms": { "type": "choice", "instructions": { … }, "criteria": { … } },
    "A.salience:rooms":  { "type": "score",  "instructions": { … }, "criteria": [ … ] }
  },
  "labels": [                             // what counts as right
    { "questionId": "A.relevance:rooms", "kind": "A.relevance", "source": "rooms", "accept": [false] }
  ],
  "invariants": [ { "type": "absent", "source": "rooms" } ],   // page properties every plan must keep
  "situation": { … }, "intent": { … }    // for replaying the pipeline
}
```

`accept` holds option labels for `choice`, booleans for `noul` (true when p ≥ 0.5) and level indices for `score` (the expected level, rounded). A label whose `questionId` is `null` is about a source the planner doesn't ask about in this situation (a business rule already decides it). It has no raw answer to score, but it still counts in decision accuracy, judged on the final page.

## Submitting

A submission is JSONL, optionally gzipped. The first line is the metadata, then one line per item and repeat, with the engine's answers in the wire format:

```jsonc
{"meta": {"engine": "my-engine", "engineVersion": "my-engine-0.3.1", "dataset": "v1", "repeats": 3,
          "openWeights": true, "weightsGB": 1.4, "offline": true,
          "trainingData": "distilled from jev-1.13.0 answers on the dev split", "createdAt": "…"}}
{"item": "hotel/arriving-today", "repeat": 0, "answers": {
   "A.relevance:rooms": {"type": "noul", "noul": 0.08},
   "B.component:rooms": {"type": "choice", "choice": "room-cards", "probabilities": {"room-cards": 0.7, "…": 0.3}},
   "A.salience:rooms":  {"type": "score", "score": 1.2, "probabilities": {"0": 0.1, "1": 0.6, "2": 0.3}}},
 "inputTokens": 4100, "latencyMs": 210}
```

- **Probabilities:** every `choice` and `score` answer needs probabilities over all of its options or levels. Confidence is computed from them the same way for every engine; a self-reported confidence is ignored.
- **Invalid answers:** an answer outside the options, or with missing probabilities, counts as unanswered, and it is **wrong** in raw accuracy. The scorer reports how many answers were invalid.
- **Repeats:** 1 to 3. Use 3 for a non-deterministic engine, so the flip rate is measured.

### Producing one

Engines that speak the System One wire format need no code:

```bash
pnpm bench run --engine rules                          # the deterministic rules engine
pnpm bench run --engine laya                           # Laya in-process (open, ~1.7 GB, offline)
W4_LOCAL_ENGINE_URL=http://localhost:<port> W4_LOCAL_ENGINE_MODEL=my-model \
  pnpm bench run --engine local --open-weights --weights-gb 1.4 --offline \
  --training-data "…"                                  # any System One endpoint on your machine
pnpm bench run --engine jev                            # hosted Jev: prints the estimated spend, sends nothing
pnpm bench run --engine jev --yes                      # …and spends it (JEV_API_KEY)
```

`--from-recordings <dir>` builds a submission from saved answer recordings without calling any engine. It fails if a recording no longer matches the questions.

### Scoring

```bash
pnpm bench score my-engine.jsonl.gz --out-dir results/
```

Scoring is offline. The scorer refuses a submission made for another dataset version, and it fails on any item without answers.

To add an entry, open a pull request using the *benchmark entry* issue template's checklist:

```bash
pnpm bench leaderboard add my-engine.jsonl.gz --id my-engine-0.3.1 --publish
```

`--publish` commits the submission, and CI re-scores it on every change: the scores must match exactly. Leave it out when the answers can't be redistributed. The entry is then marked **reported only**.

## How it scores

The scorer replays the submission through web4's planner, using the conformance suite's own runner, so the numbers are the ones web4 uses. Scoring the rules engine's answers gives exactly the numbers of a conformance run with the rules engine (a test checks this).

Per split, site, question kind and language it reports:

- **Raw accuracy:** labelled answers that are right, before any gating.
- **Decision accuracy:** labels scored against the final page, after confidence gating, defaults, invariants and the rules fallback. This is what a visitor gets.
- **Invariant pass rate:** page properties that must hold in every plan (business rules such as "never offer rooms to guests already staying").
- **Confidence of correct vs incorrect answers**, **uncalibrated** combinations (where no threshold separates them) and **flip rate** across repeats.

**Calibration.** Each entry is calibrated on its own answers, site by site, exactly as the conformance suite calibrates an engine. This flatters every entry in the same way, so rankings compare like with like. Raw accuracy, which involves no gating, is a headline number for that reason.

**Why rules scores 100% on the test split.** The starters' hand-written heuristics cover their fixtures completely, and the rules engine replays those heuristics. web4's point is that a model shouldn't need them: the [heuristic ablation](../reports/ablation/report.md) measures what happens when they're removed. Rules is on the leaderboard as the floor web4 falls back to. It is not a System One engine, so it can't meet the challenge.

## Licence

The dataset and the scorer are MIT, like the rest of the repository.
