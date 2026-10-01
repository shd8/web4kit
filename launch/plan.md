# Launch plan

The order matters: nothing public goes out until the release is verified and the site is live. Social handles are optional and only change the links in step 3.

## 1. Before launch

Do these in order; each one has a way to check it worked.

- [ ] **Rename** the repository to `shd8/web4kit` (Settings → General), then `git remote set-url origin https://github.com/shd8/web4kit.git`. Check: `gh repo view shd8/web4kit`.
- [x] **TypeSafe console URL** confirmed: `https://docs.typesafe.ai` (`TYPESAFE_CONSOLE_URL` in `apps/site/lib/links.ts`).
- [ ] **Make it public** (Settings → General → Danger zone). Check: the repository page has no "Private" badge.
- [ ] **Enable Discussions**, with a *Thesis* category (Settings → General → Features). Check: the category uses `.github/DISCUSSION_TEMPLATE/thesis.yml`.
- [ ] **Enable private vulnerability reporting** (Settings → Code security), which `SECURITY.md` points to.
- [ ] **Pages:** Settings → Pages → Source: *GitHub Actions*. Then run the Pages workflow (Actions → Pages → Run workflow). Check: <https://shd8.github.io/web4kit/> serves the site, and the playground switches plans.
- [ ] **npm token:** a granular token with *Read and write (stage only)* on **All packages** (new names can't be selected), with 2FA bypass, so CI can stage versions but never publish them on its own. The `web4kit` npm organization must exist for `@web4kit/*`.
- [ ] **Secrets:** add `NPM_TOKEN` (Settings → Secrets → Actions) and the variable `RELEASE_ENABLED=true`.
- [ ] **Release 0.2.0:** merge the *Version Packages* pull request the Release workflow opens. The workflow stages all 12 packages.
  - Approve each with 2FA: `npm stage list`, then `npm stage approve <stage-id>`.
  - Run *Smoke test npm* with version `0.2.0`, and check that it passes.
  - Check: `npm view @web4kit/planner version` prints `0.2.0`, and the npm page shows provenance.
- [ ] **Deprecate the placeholder:** `npm deprecate web4kit@0.0.1 "Placeholder; use web4kit@latest"`. Check: `npx web4kit@latest --help` prints the CLI's help with no warning.
- [ ] **Try it as a stranger:** in an empty folder, `pnpm create web4kit my-site && cd my-site && pnpm install && pnpm dev`.
- [ ] **Re-read the thesis numbers** against `reports/` and `bench/leaderboard/`, if either was regenerated.
- [ ] **Post the thesis discussion:** the text of `apps/site/content/thesis.mdx` with absolute links, in the *Thesis* category. Pin it.
- [ ] **The cuts** are rendered with the voiceover and published: the full 85 s cut everywhere: `main-16x9` on the site (`apps/site/public/media/`), in the README (its 720p copy, under GitHub's 10 MB limit) and on X; `main-1x1` (square) for LinkedIn. The video sources and the post texts are kept privately.

## 2. Launch day

Morning (US East), in this order, an hour or so apart, so the first questions get answered:

1. **Show HN:** "Show HN: web4kit – web pages that pick what to show each visitor". Link the site; post the first comment yourself, with what it is, the ablation result as measured, and the benchmark challenge.
2. **X thread:** the full video first, then the playground link, the cost line, the ablation line (as measured), the benchmark challenge, and the repository.
3. **LinkedIn:** "Web 4 is here." with the full video, square.
4. **Communities:** r/webdev and r/nextjs (a "how it works" post, not an announcement), and the Next.js discussions. One post each; don't cross-post the same text.

Spend the rest of the day answering. The prepared answers are below.

## 3. Prepared answers

Short forms; the [FAQ](https://shd8.github.io/web4kit/faq/) is the long form. Every claim links to its source. Don't add numbers that aren't in these sources.

**"Isn't this just if/else?"**
Partly, and we measured it. With every hand-written heuristic removed, Jev was 25.4 points of decision accuracy above the rules engine (25.0 without `audience` lines too). But the pre-registered verdict is *not shown*: without audiences, Jev kept only 65.2% of invariants on the explorer and 97.7% on the hotel. The model covers situations nobody wrote a rule for; it doesn't make business rules optional.
Source: [ablation report](../reports/ablation/report.md), [follow-up](../reports/ablation/followup-placement/report.md).

**"What does Google see?"**
A complete, neutral page: every public source, default components, manifest order, no model asked, the same for every crawler per device class.
Source: [SEO and crawlers](../docs/seo.md).

**"Vendor lock-in?"**
One `Decider` interface: hosted Jev, Laya in-process, any System One endpoint, a cascade, or rules. Today hosted Jev is the engine accurate enough to plan alone; web4-bench is the open challenge to change that.
Source: [engines](../docs/engines.md), [web4-bench](../bench/README.md).

**"Dark patterns?"**
No generated text: the model selects among declared sources and components. `mustInclude` / `mustExclude` are applied in code, not asked of the model. Third-party text never reaches the model. Every decision is recorded.
Source: [FAQ](https://shd8.github.io/web4kit/faq/), [concepts](https://shd8.github.io/web4kit/concepts/).

**"Forms?"**
Not yet: v0 plans read-only pages. Forms and actions are first on the roadmap.
Source: [roadmap](../ROADMAP.md).

**"How much does it cost?"**
$0.00029 per uncached page on the restaurant ($0.00031 on the explorer), at p50 271 ms; cached pages cost nothing.
Source: [restaurant report](../reports/conformance-casa-lumbre.md), [explorer report](../reports/conformance-meridian-ops.md).

**"Why not an LLM?"**
An LLM generates; web4 selects. System One models answer typed questions with probabilities, which can be calibrated, gated and audited, at a fraction of the cost and latency.
Source: [thesis](https://shd8.github.io/web4kit/thesis/).
