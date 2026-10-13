---
"@web4kit/manifest": minor
"@web4kit/planner": minor
"@web4kit/conformance": minor
---

Add an optional site `purpose` to `defineManifests`: one sentence (up to 120 characters) about what the site is for, shown to the decider with every source. Manifests without a purpose keep identical questions and versions, so existing calibration profiles stay active. `runEngine` can now score decisions ungated (`decisions: "ungated"`), using the engine's answers with no calibration profile.
