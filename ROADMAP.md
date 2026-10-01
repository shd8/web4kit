# Roadmap

web4kit plans read-only pages today. These are the next steps, in order. None of them has a date.

## 1. Interactivity: forms and actions

Pages that do things, not only show them: booking a table, ordering, signing up. The planner would choose *which* action to offer and where, just as it chooses sources today. The action itself (fields, validation, submission) stays declared and deterministic, and nothing is generated.

## 2. Learning from clicks

Today the only feedback is the conformance suite's labels. The plan is to let a site record which blocks visitors actually used, without personal data, and turn that into labelled fixtures. Calibration would then reflect real behaviour, not only what the owner expected.

## 3. Distillation and small engines

A small open System One engine, at most 2 GB of weights, running offline (and eventually in the browser), that plans as well as Jev. That's the [web4-bench challenge](bench/README.md). The same `Decider` interface would serve it, so sites switch engines without changing their manifests.

## Not planned

- **Generated copy or layouts.** web4 selects among what you declared. It doesn't write text or invent components.
- **LLM deciders.** web4 is built on System One models by design.

Ideas and discussion are welcome in [GitHub Discussions](https://github.com/shd8/web4kit/discussions).
