/**
 * Score a submission (spec: benchmark, design D5). The answers are replayed through the planner
 * with the conformance suite's own runner, so the numbers are the ones web4 uses. Offline.
 */
import {
  createReplayDecider,
  type EngineRun,
  isCorrect,
  type Recordings,
  recordingKey,
  runEngine,
  type SituatedFixture,
} from "@web4kit/conformance";
import {
  type AnswerOrUnanswered,
  type AnswerSet,
  type Capabilities,
  normalizeWireAnswer,
  type Question,
  toWireQuestion,
} from "@web4kit/decider";
import { buildQuestions } from "@web4kit/planner";
import type { Dataset } from "./data";
import { expectedFrom } from "./export";
import type { Split, Submission, SubmissionMeta } from "./format";

export interface Rate {
  samples: number;
  accuracy: number;
}

export interface KindScore {
  raw: Rate;
  decision?: Rate;
  meanConfidenceCorrect: number;
  meanConfidenceIncorrect: number;
  uncalibrated: boolean;
  threshold?: number;
  flipRate?: number;
}

export interface SiteScore {
  split: Split;
  items: number;
  rawAccuracy: number;
  decisionAccuracy: number;
  invariantPassRate: number;
  invariantChecks: number;
  invariantFailures: number;
  /** `${kind}|${language}` */
  kinds: Record<string, KindScore>;
}

export interface SplitScore {
  sites: string[];
  items: number;
  rawAccuracy: number;
  decisionAccuracy: number;
  invariantPassRate: number;
  labelledAnswers: number;
  uncalibrated: string[];
}

export interface Score {
  dataset: { version: string; contentHash: string };
  submission: SubmissionMeta;
  answers: { total: number; invalid: number; missing: number };
  usage: { inputTokensPerItem: number | null; latencyMsP50: number | null };
  splits: Record<Split, SplitScore>;
  sites: Record<string, SiteScore>;
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** Questions an engine is asked count as answered only when their answer is valid. */
export async function scoreSubmission(dataset: Dataset, submission: Submission): Promise<Score> {
  const { meta } = submission;
  if (meta.dataset !== dataset.meta.version)
    throw new Error(
      `submission answers web4-bench ${meta.dataset}, but this is web4-bench ${dataset.meta.version}`,
    );
  const repeats = Math.max(1, Math.min(3, Math.round(meta.repeats)));
  if (repeats !== meta.repeats) throw new Error(`repeats must be 1, 2 or 3 (got ${meta.repeats})`);

  const byItem = new Map<string, Submission["lines"]>();
  for (const line of submission.lines) {
    const list = byItem.get(line.item) ?? [];
    list[line.repeat] = line;
    byItem.set(line.item, list);
  }

  const counts = { total: 0, invalid: 0, missing: 0 };
  const sites: Record<string, SiteScore> = {};
  const tokens: number[] = [];
  const latencies: number[] = [];

  for (const [site, { items, manifests }] of Object.entries(dataset.sites)) {
    const split = dataset.meta.sites[site]!.split;
    const sets: Recordings["sets"] = {};
    const fixtures: SituatedFixture[] = [];
    const raw = new Map<string, { correct: number; samples: number }>();

    for (const item of items) {
      const lines = byItem.get(item.id) ?? [];
      for (let r = 0; r < repeats; r++)
        if (!lines[r]) throw new Error(`submission has no answers for ${item.id} (repeat ${r})`);
      const qp = buildQuestions(
        manifests,
        item.situation,
        item.intent ? { intent: item.intent } : {},
      );
      const wire = Object.fromEntries(
        Object.entries(qp.questions).map(([id, q]) => [id, toWireQuestion(q)]),
      );
      if (
        JSON.stringify({ s: qp.state, q: wire }) !==
        JSON.stringify({ s: item.state, q: item.questions })
      )
        throw new Error(`${item.id}: the dataset's manifests no longer produce its questions`);

      const answerSets = lines.slice(0, repeats).map((line): AnswerSet => {
        const answers: Record<string, AnswerOrUnanswered> = {};
        for (const [qid, question] of Object.entries(qp.questions)) {
          counts.total++;
          const given = line!.answers[qid];
          if (!given) counts.missing++;
          const a = normalizeWireAnswer(question as Question, given, {
            engine: meta.engineVersion,
          });
          if (given && a.type === "unanswered") counts.invalid++;
          answers[qid] = a;
        }
        if (line!.inputTokens !== undefined) tokens.push(line!.inputTokens);
        if (line!.latencyMs !== undefined) latencies.push(line!.latencyMs);
        return {
          answers,
          engineVersion: meta.engineVersion,
          usage: { inputTokens: line!.inputTokens ?? 0, requests: 1 },
        };
      });
      const key = recordingKey(qp.state, qp.questions);
      sets[key] = [...(sets[key] ?? []), ...answerSets];

      // Raw accuracy, where an invalid or missing answer is wrong (the runner skips it).
      const language = item.intent?.language ?? "english";
      for (const label of item.labels) {
        if (!label.questionId) continue;
        const k = `${label.kind}|${language}`;
        const stat = raw.get(k) ?? { correct: 0, samples: 0 };
        for (const set of answerSets) {
          const a = set.answers[label.questionId];
          stat.samples++;
          if (a && a.type !== "unanswered" && isCorrect(a, label)) stat.correct++;
        }
        raw.set(k, stat);
      }

      fixtures.push({
        name: item.id.slice(site.length + 1),
        envelope: {} as SituatedFixture["envelope"],
        situation: item.situation,
        ...(item.intent ? { intent: item.intent } : {}),
        invariants: item.invariants,
        expected: expectedFrom(item.labels),
      });
    }

    const capabilities: Capabilities = {
      maxStateTokens: Number.MAX_SAFE_INTEGER,
      maxRequestTokens: Number.MAX_SAFE_INTEGER,
      maxQuestionsPerRequest: Number.MAX_SAFE_INTEGER,
      maxChoiceOptions: Number.MAX_SAFE_INTEGER,
      maxCriteriaTokens: Number.MAX_SAFE_INTEGER,
      primitives: ["choice", "score", "noul"],
      languages: ["*"],
      modalities: ["text"],
      locality: "local",
      deterministic: repeats === 1,
      p50LatencyMs: 0,
      costPerMTok: 0,
    };
    const decider = createReplayDecider(
      { engine: meta.engine, engineVersion: meta.engineVersion, sets },
      capabilities,
    );
    const run = await runEngine({ manifests, fixtures, decider, repeats });
    sites[site] = siteScore(split, items.length, run, raw, fixtures);
  }

  const splits = {} as Record<Split, SplitScore>;
  for (const split of ["dev", "test"] as const) splits[split] = pool(split, sites);
  return {
    dataset: { version: dataset.meta.version, contentHash: dataset.meta.contentHash },
    submission: meta,
    answers: counts,
    usage: {
      inputTokensPerItem: tokens.length
        ? r6(tokens.reduce((a, b) => a + b, 0) / tokens.length)
        : null,
      latencyMsP50: latencies.length ? median(latencies) : null,
    },
    splits,
    sites,
  };
}

function siteScore(
  split: Split,
  items: number,
  run: EngineRun,
  raw: Map<string, { correct: number; samples: number }>,
  fixtures: SituatedFixture[],
): SiteScore {
  const kinds: Record<string, KindScore> = {};
  for (const [key, stat] of [...raw].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const k = run.byKind[key];
    const d = run.decisionAccuracy[key];
    kinds[key] = {
      raw: { samples: stat.samples, accuracy: r6(stat.samples ? stat.correct / stat.samples : 0) },
      ...(d ? { decision: { samples: d.samples, accuracy: r6(d.accuracy) } } : {}),
      meanConfidenceCorrect: r6(k?.meanConfidenceCorrect ?? 0),
      meanConfidenceIncorrect: r6(k?.meanConfidenceIncorrect ?? 0),
      uncalibrated: k?.uncalibrated === true,
      ...(k?.threshold !== undefined ? { threshold: r6(k.threshold) } : {}),
      ...(k?.flipRate !== undefined ? { flipRate: r6(k.flipRate) } : {}),
    };
  }
  const checks = fixtures.reduce((n, f) => n + f.invariants.length, 0);
  return {
    split,
    items,
    rawAccuracy: r6(rate([...raw.values()].map((s) => [s.correct, s.samples]))),
    decisionAccuracy: r6(pooledRate(run.decisionAccuracy)),
    invariantPassRate: r6(run.invariantPassRate),
    invariantChecks: checks,
    invariantFailures: run.invariantFailures.length,
    kinds,
  };
}

function pool(split: Split, sites: Record<string, SiteScore>): SplitScore {
  const mine = Object.entries(sites).filter(([, s]) => s.split === split);
  const kinds = mine.flatMap(([, s]) => Object.values(s.kinds));
  const checks = mine.reduce((n, [, s]) => n + s.invariantChecks, 0);
  const failures = mine.reduce((n, [, s]) => n + s.invariantFailures, 0);
  return {
    sites: mine.map(([k]) => k),
    items: mine.reduce((n, [, s]) => n + s.items, 0),
    rawAccuracy: r6(rate(kinds.map((k) => [k.raw.accuracy * k.raw.samples, k.raw.samples]))),
    decisionAccuracy: r6(
      rate(
        kinds
          .filter((k) => k.decision)
          .map((k) => [k.decision!.accuracy * k.decision!.samples, k.decision!.samples]),
      ),
    ),
    invariantPassRate: r6(checks ? (checks - failures) / checks : 1),
    labelledAnswers: kinds.reduce((n, k) => n + k.raw.samples, 0),
    uncalibrated: mine.flatMap(([site, s]) =>
      Object.entries(s.kinds)
        .filter(([, k]) => k.uncalibrated)
        .map(([key]) => `${site}:${key}`),
    ),
  };
}

/** Pooled over kinds, weighted by samples (as the ablation pools decision accuracy). */
function pooledRate(m: Record<string, { samples: number; accuracy: number }>): number {
  return rate(Object.values(m).map((x) => [x.accuracy * x.samples, x.samples]));
}
function rate(pairs: Array<[number, number]>): number {
  const total = pairs.reduce((n, [, s]) => n + s, 0);
  return total ? pairs.reduce((n, [c]) => n + c, 0) / total : 0;
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function renderScore(score: Score): string {
  const { submission: m } = score;
  const lines = [
    `# web4-bench ${score.dataset.version}: ${m.engineVersion}`,
    "",
    `Engine \`${m.engine}\` (${m.engineVersion}) · ${m.repeats} repeat(s) · open weights: ${m.openWeights ? "yes" : "no"} · weights: ${m.weightsGB ?? "n/a"} GB · offline: ${m.offline ? "yes" : "no"}`,
    `Training data: ${m.trainingData}`,
    `Dataset hash \`${score.dataset.contentHash.slice(0, 12)}\` · answers ${score.answers.total.toLocaleString("en")} (invalid ${score.answers.invalid}, missing ${score.answers.missing})`,
    "",
    "| split | sites | items | raw accuracy | decision accuracy | invariants | uncalibrated |",
    "|---|---|---|---|---|---|---|",
    ...(["dev", "test"] as const).map((k) => {
      const s = score.splits[k];
      return `| ${k} | ${s.sites.join(", ")} | ${s.items} | ${pct(s.rawAccuracy)} | ${pct(s.decisionAccuracy)} | ${pct(s.invariantPassRate)} | ${s.uncalibrated.length ? s.uncalibrated.join(", ") : "none"} |`;
    }),
    "",
    "| site | kind | raw | decision | conf. correct / incorrect | threshold | flip rate |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const [site, s] of Object.entries(score.sites)) {
    for (const [kind, k] of Object.entries(s.kinds)) {
      lines.push(
        `| ${site} | ${kind} | ${pct(k.raw.accuracy)} (${k.raw.samples}) | ${k.decision ? pct(k.decision.accuracy) : "–"} | ${k.meanConfidenceCorrect.toFixed(2)} / ${k.meanConfidenceIncorrect.toFixed(2)} | ${k.uncalibrated ? "uncalibrated" : (k.threshold?.toFixed(3) ?? "–")} | ${k.flipRate !== undefined ? pct(k.flipRate) : "–"} |`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
