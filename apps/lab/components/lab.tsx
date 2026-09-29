"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type ContextEnvelope, situationHash } from "@web4/context";
import { defaultRegistry, inspectPlan, type PlanData, PlanView } from "@web4/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type EngineChoice,
  type EngineInfo,
  EXAMPLES,
  type LabExample,
  type PlanResponse,
} from "@/lib/examples";
import { ContextPanel } from "./context-panel";
import { cx, Section, Segmented } from "./ui";
import { WhyPanel } from "./why-panel";

export interface LabProps {
  exampleId: LabExample["id"];
  engines: EngineInfo[];
  initial: {
    envelope: ContextEnvelope;
    engine: EngineChoice;
    question: string;
    plan: PlanResponse;
    data: PlanData;
    preset?: string;
  };
}

const detectLanguage = (text: string) =>
  /[¿¡ñáéíóú]|\b(qué|que|proveedores|tarde|este|mes|los|las)\b/i.test(text) ? "spanish" : "english";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json() as Promise<T>;
}

export function Lab({ exampleId, engines, initial }: LabProps) {
  const example = EXAMPLES[exampleId];
  const [envelope, setEnvelope] = useState(initial.envelope);
  const [engine, setEngine] = useState<EngineChoice>(initial.engine);
  const [question, setQuestion] = useState(initial.question);
  const [preset, setPreset] = useState<string | undefined>(initial.preset);
  const [showWhy, setShowWhy] = useState(true);
  // Set in event handlers: did the last change alter the situation (the decider's only input)?
  const [change, setChange] = useState<{ kind: "none" | "same" | "new"; at: number }>({
    kind: "none",
    at: 0,
  });

  // The decider only ever sees the situation, so the situation is the plan's identity.
  const situation = useMemo(() => example.situationOf(envelope), [example, envelope]);
  const hash = situationHash(situation);
  const intent = question.trim()
    ? { text: question.trim(), language: detectLanguage(question) }
    : undefined;
  const initialKey = situationHash(initial.plan.situation);

  const planQuery = useQuery({
    queryKey: ["plan", exampleId, hash, engine, intent?.text ?? ""],
    queryFn: () =>
      post<PlanResponse>("/api/plan", { example: exampleId, envelope, engine, intent }),
    initialData:
      hash === initialKey && engine === initial.engine && (intent?.text ?? "") === initial.question
        ? initial.plan
        : undefined,
    placeholderData: keepPreviousData,
  });
  const response = planQuery.data ?? initial.plan;

  // Data is resolved at render time and refreshed independently of the (cached) decisions.
  const dataKey = `${Math.floor(new Date(envelope.now).getTime() / 60_000)}:${envelope.geo?.lat.toFixed(3)}:${envelope.languages[0]}:${envelope.roles?.join()}`;
  const dataQuery = useQuery({
    queryKey: [
      "data",
      exampleId,
      response.plan.situationHash,
      response.engineId,
      dataKey,
      response.plan.layout,
    ],
    queryFn: () =>
      post<PlanData>("/api/data", { example: exampleId, plan: response.plan, envelope }),
    initialData: response === initial.plan ? initial.data : undefined,
    placeholderData: keepPreviousData,
  });

  const rendered = useMemo(
    () =>
      dataQuery.data
        ? inspectPlan(response.plan, dataQuery.data, example.manifests, defaultRegistry)
        : [],
    [response.plan, dataQuery.data, example.manifests],
  );
  const cacheLabel = planQuery.isFetching
    ? "planning…"
    : change.kind === "same"
      ? "hit · situation unchanged, no decider call"
      : change.kind === "new" && !planQuery.isPlaceholderData && planQuery.dataUpdatedAt < change.at
        ? "hit · seen situation, no decider call"
        : response.cacheHit
          ? "hit (server)"
          : "miss · planned";
  const deviceWidth = { mobile: "max-w-[420px]", tablet: "max-w-[820px]", desktop: "max-w-none" }[
    response.plan.device
  ];

  const update = (next: ContextEnvelope, nextQuestion = question, nextEngine = engine) => {
    const same =
      situationHash(example.situationOf(next)) === hash &&
      nextQuestion.trim() === question.trim() &&
      nextEngine === engine;
    setChange({ kind: same ? "same" : "new", at: Date.now() });
    setEnvelope(next);
    setQuestion(nextQuestion);
    setEngine(nextEngine);
  };

  const applyPreset = (name: string) => {
    const f = example.fixtures.find((x) => x.name === name);
    if (!f) return;
    setPreset(name);
    update(f.envelope, f.intent?.text ?? "");
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white/85 px-4 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="font-code text-sm font-semibold tracking-tight">web4</span>
          <span className="font-code text-xs text-zinc-500">lab</span>
        </Link>
        <nav className="flex gap-1">
          {Object.values(EXAMPLES).map((e) => (
            <Link
              key={e.id}
              href={`/${e.id}`}
              className={cx(
                "rounded-md px-2.5 py-1 text-sm",
                e.id === exampleId
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              {e.name}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden font-code text-[0.68rem] uppercase tracking-wider text-zinc-500 sm:inline">
            engine
          </span>
          <div className="w-72">
            <Segmented
              size="md"
              options={engines.map((e) => ({
                id: e.id,
                label: e.label,
                disabled: !e.available,
                title: e.detail,
              }))}
              value={engine}
              onChange={(e) => update(envelope, question, e)}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowWhy((v) => !v)}
            className={cx(
              "rounded-md border px-2.5 py-1 text-sm",
              showWhy
                ? "border-zinc-900 dark:border-white"
                : "border-zinc-300 text-zinc-600 dark:border-zinc-700",
            )}
          >
            Why
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-zinc-200 bg-white lg:sticky lg:top-[53px] lg:h-[calc(100dvh-53px)] lg:w-80 lg:overflow-y-auto lg:border-r lg:border-b-0 dark:border-zinc-800 dark:bg-zinc-950">
          <Section title="Personas">
            <div className="grid gap-1.5">
              {example.fixtures.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => applyPreset(f.name)}
                  className={cx(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    preset === f.name
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-950/60"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
                  )}
                >
                  {f.title ?? f.name}
                </button>
              ))}
            </div>
          </Section>
          <ContextPanel
            example={example}
            envelope={envelope}
            onChange={(e) => {
              setPreset(undefined);
              update(e);
            }}
            question={question}
            onQuestion={(q) => {
              setPreset(undefined);
              update(envelope, q);
            }}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 text-xs text-zinc-500 sm:px-6">
            <span className="font-code">
              {example.name} · same URL · {response.plan.device} ·{" "}
              {planQuery.isFetching
                ? "planning…"
                : `planned in ${Math.round(response.planningMs)} ms`}
            </span>
            <span className={cx("font-code", planQuery.isError && "text-rose-600")}>
              {planQuery.isError ? "planning failed, showing last plan" : ""}
            </span>
          </div>
          <div className="px-3 py-4 sm:px-6">
            <div
              data-w4-theme={example.theme}
              className={cx(
                "mx-auto rounded-2xl bg-background p-3 text-foreground shadow-sm ring-1 ring-zinc-200 transition-[max-width] duration-300 sm:p-5 dark:ring-zinc-800",
                deviceWidth,
                (planQuery.isFetching || dataQuery.isFetching) && "opacity-80",
              )}
            >
              {dataQuery.data && (
                <PlanView
                  plan={response.plan}
                  data={dataQuery.data}
                  manifests={example.manifests}
                  registry={defaultRegistry}
                />
              )}
            </div>
          </div>
          {showWhy && (
            <div className="sticky bottom-0 max-h-[46dvh] overflow-y-auto border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
              <WhyPanel response={response} rendered={rendered} cacheLabel={cacheLabel} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
