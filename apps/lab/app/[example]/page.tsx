import { collectEnvelope } from "@web4/context";
import { defaultRegistry, PlanView } from "@web4/react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Lab } from "@/components/lab";
import { type EngineChoice, EXAMPLES, isExampleId } from "@/lib/examples";
import { dataFor, engines, LAB_MODE, planFor } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function ExamplePage({
  params,
  searchParams,
}: {
  params: Promise<{ example: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { example: id } = await params;
  if (!isExampleId(id)) notFound();
  const example = EXAMPLES[id];
  const query = await searchParams;

  if (!LAB_MODE) {
    // Production mode: real Tier 0 signals only; lab parameters are ignored.
    const h = await headers();
    // Real request signals, including ?src= and utm_* (lab-only parameters are simply not read).
    const search = new URLSearchParams(
      Object.entries(query).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
    const url = `http://${h.get("host") ?? "localhost"}/${id}?${search}`;
    const { envelope } = collectEnvelope({ url, headers: h });
    const { plan } = await planFor(id, envelope, "rules");
    const data = await dataFor(id, plan, envelope);
    return (
      <main
        data-w4-theme={example.theme}
        className="min-h-dvh bg-background p-3 text-foreground sm:p-6"
      >
        <PlanView
          plan={plan}
          data={data}
          manifests={example.manifests}
          registry={defaultRegistry}
        />
      </main>
    );
  }

  const available = await engines();
  const requested = query.engine as EngineChoice | undefined;
  const engine: EngineChoice =
    available.find((e) => e.id === requested && e.available)?.id ??
    (available.find((e) => e.id === "jev")?.available ? "jev" : "rules");
  const presetName = query.w4_ctx ?? example.fixtures[0]!.name;
  const fixture = example.fixtures.find((f) => f.name === presetName) ?? example.fixtures[0]!;
  const question = fixture.intent?.text ?? "";
  const plan = await planFor(id, fixture.envelope, engine, fixture.intent);
  const data = await dataFor(id, plan.plan, fixture.envelope);

  return (
    <Lab
      key={id}
      exampleId={id}
      engines={available}
      initial={{ envelope: fixture.envelope, engine, question, plan, data, preset: fixture.name }}
    />
  );
}
