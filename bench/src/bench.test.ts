import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { runEngine } from "@web4kit/conformance";
import { QuestionSchema } from "@web4kit/decider";
import { createManifestRuleDecider, createPlanner } from "@web4kit/planner";
import { describe, expect, it } from "vitest";
import type { Dataset } from "./data";
import { exportDataset, manifestsFromJson, manifestsToJson, siteItems } from "./export";
import { DATASET_VERSION, fromJsonl, type Item, type Submission } from "./format";
import { makeSubmission, recordingsDecider } from "./run";
import { scoreSubmission } from "./score";
import { SITES, siteByKey } from "./sites";

/** The dataset in memory, exactly as `loadDataset` would read it back from the export. */
function dataset(): Dataset {
  const { files, meta } = exportDataset();
  return {
    meta,
    sites: Object.fromEntries(
      SITES.map((s) => [
        s.key,
        {
          items: fromJsonl<Item>(files[`${s.key}.items.jsonl`]!),
          manifests: manifestsFromJson(JSON.parse(files[`${s.key}.manifests.json`]!)),
        },
      ]),
    ),
  };
}

const rulesSubmission = () =>
  makeSubmission({
    engineFor: (site) => createManifestRuleDecider(site.manifests),
    repeats: 1,
    meta: { engine: "rules", openWeights: true, weightsGB: 0, offline: true, trainingData: "none" },
  });

describe("web4-bench dataset (launch-go-public 3.2–3.4)", () => {
  it("splits the four sites into dev (examples) and test (starters)", () => {
    const { meta } = exportDataset();
    expect(meta.splits.dev.sites).toEqual(["restaurant", "explorer"]);
    expect(meta.splits.test.sites).toEqual(["hotel", "welcome"]);
    expect(Object.fromEntries(Object.entries(meta.sites).map(([k, s]) => [k, s.items]))).toEqual({
      restaurant: 164,
      explorer: 113,
      hotel: 105,
      welcome: 27,
    });
    const ids = SITES.flatMap((s) => siteItems(s).map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exports byte-identical files with the same hash every time", () => {
    const a = exportDataset();
    const b = exportDataset();
    expect(a.files).toEqual(b.files);
    expect(a.meta.contentHash).toBe(b.meta.contentHash);
  });

  it("ships labels only: no answers, probabilities or engine ids", () => {
    const { files } = exportDataset();
    const keys = new Set<string>();
    const strings: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === "string") strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object")
        for (const [k, x] of Object.entries(v)) {
          keys.add(k);
          walk(x);
        }
    };
    for (const text of Object.values(files))
      for (const line of text.split("\n").filter(Boolean)) walk(JSON.parse(line));
    for (const k of ["answers", "probabilities", "engineVersion", "confidence"])
      expect(keys.has(k)).toBe(false);
    expect(strings.filter((s) => /^(jev|laya|ollaya)[-:@]/i.test(s))).toEqual([]);
  });

  it("states every question in the pure System One wire format", () => {
    for (const site of SITES)
      for (const item of siteItems(site))
        for (const q of Object.values(item.questions)) {
          expect(Object.keys(q).sort()).toEqual(
            "criteria" in q ? ["criteria", "instructions", "type"] : ["instructions", "type"],
          );
          expect(QuestionSchema.safeParse(q).success).toBe(true);
        }
  });

  it("plans the same pages from the exported manifests as from the originals", async () => {
    for (const site of SITES) {
      const json = manifestsFromJson(JSON.parse(JSON.stringify(manifestsToJson(site.manifests))));
      expect(json.deciderVersion).toBe(site.manifests.deciderVersion);
      const plan = (m: typeof site.manifests, f: (typeof fixtures)[number]) =>
        createPlanner({ manifests: m, decider: createManifestRuleDecider(m) })
          .plan({ situation: f.situation, ...(f.intent ? { intent: f.intent } : {}) })
          .then((r) => JSON.stringify(r.plan.layout));
      const fixtures = site.fixtures().slice(0, 25);
      for (const f of fixtures) expect(await plan(json, f)).toBe(await plan(site.manifests, f));
    }
  });
});

describe("web4-bench scoring (launch-go-public 4.1–4.3)", () => {
  it("scores the rules engine exactly as a conformance run does (parity)", async () => {
    const score = await scoreSubmission(dataset(), await rulesSubmission());
    for (const site of SITES) {
      const direct = await runEngine({
        manifests: site.manifests,
        fixtures: site.fixtures(),
        decider: createManifestRuleDecider(site.manifests),
      });
      const s = score.sites[site.key]!;
      expect(s.invariantPassRate).toBeCloseTo(direct.invariantPassRate, 6);
      for (const [key, d] of Object.entries(direct.decisionAccuracy))
        expect(s.kinds[key]?.decision?.accuracy).toBeCloseTo(d.accuracy, 6);
      for (const [key, k] of Object.entries(direct.byKind)) {
        expect(s.kinds[key]?.raw.samples).toBe(k.samples);
        expect(s.kinds[key]?.raw.accuracy).toBeCloseTo(k.accuracy, 6);
      }
    }
    expect(score.answers.invalid).toBe(0);
  }, 120_000);

  it("counts an answer outside the options as unanswered and wrong", async () => {
    const data = dataset();
    const submission = await rulesSubmission();
    const before = await scoreSubmission(data, submission);
    // Corrupt every component answer on the hotel.
    const broken: Submission = {
      ...submission,
      lines: submission.lines.map((l) =>
        l.item.startsWith("hotel/")
          ? {
              ...l,
              answers: Object.fromEntries(
                Object.entries(l.answers).map(([id, a]) => [
                  id,
                  id.startsWith("B.") ? { ...a, choice: "no-such-component" } : a,
                ]),
              ),
            }
          : l,
      ),
    };
    const after = await scoreSubmission(data, broken);
    expect(after.answers.invalid).toBeGreaterThan(0);
    const raw = (s: typeof after) => s.sites.hotel!.kinds["B.component|english"]!.raw;
    expect(raw(before).accuracy).toBe(1);
    expect(raw(after).samples).toBe(raw(before).samples);
    expect(raw(after).accuracy).toBe(0);
  }, 120_000);

  it("refuses a submission for another dataset version, naming both", async () => {
    const submission = await rulesSubmission();
    await expect(
      scoreSubmission(dataset(), { ...submission, meta: { ...submission.meta, dataset: "v0" } }),
    ).rejects.toThrow(`answers web4-bench v0, but this is web4-bench ${DATASET_VERSION}`);
  });

  it("fails on an item the submission does not answer", async () => {
    const submission = await rulesSubmission();
    const lines = submission.lines.filter((l) => l.item !== "hotel/arriving-today");
    await expect(scoreSubmission(dataset(), { ...submission, lines })).rejects.toThrow(
      "no answers for hotel/arriving-today",
    );
  });

  it("replays recordings without calling an engine, and fails on an unrecorded question set", async () => {
    const welcome = siteByKey("welcome");
    const recorder = await makeSubmission({
      engineFor: (s) => createManifestRuleDecider(s.manifests),
      repeats: 1,
      sites: [welcome],
      meta: {
        engine: "rules",
        openWeights: true,
        weightsGB: 0,
        offline: true,
        trainingData: "none",
      },
    });
    expect(recorder.lines).toHaveLength(27);
    const empty = recordingsDecider({ engine: "jev", engineVersion: "jev-1.13.0", sets: {} });
    await expect(
      makeSubmission({
        engineFor: empty,
        repeats: 1,
        sites: [welcome],
        meta: {
          engine: "jev",
          openWeights: false,
          weightsGB: null,
          offline: false,
          trainingData: "-",
        },
      }),
    ).rejects.toThrow("no recording for a question set");
  });

  it("estimates a hosted Jev run and sends nothing without --yes", async () => {
    let requests = 0;
    const server = createServer((_, res) => {
      requests++;
      res.writeHead(500).end();
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    const out = spawnSync(
      "pnpm",
      ["exec", "tsx", resolve(import.meta.dirname, "cli.ts"), "run", "--engine", "jev"],
      {
        encoding: "utf8",
        env: { ...process.env, JEV_API_KEY: "test", JEV_BASE_URL: `http://127.0.0.1:${port}` },
      },
    );
    server.close();
    expect(out.status).toBe(0);
    expect(out.stdout).toMatch(/requests, ~[\d,]+ input tokens, ~\$\d+\.\d\d/);
    expect(out.stdout).toContain("Nothing was sent");
    expect(requests).toBe(0);
  }, 60_000);
});
