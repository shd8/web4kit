import { PreviewBar } from "@web4kit/next";
import { PlanView } from "@web4kit/react";
import { XRay } from "@web4kit/react/xray";
import { registry } from "@/web4/components";
import { site } from "@/web4/site";

export const dynamic = "force-dynamic";

const LINKS = [
  {
    href: "https://github.com/shd8/web4kit/blob/main/docs/getting-started.md",
    title: "Docs",
    text: "Sources, situations, calibration.",
  },
  {
    href: "https://github.com/shd8/web4kit/tree/main/examples",
    title: "Examples",
    text: "A restaurant and a database explorer.",
  },
  {
    href: "https://github.com/shd8/web4kit/tree/main/templates/hotel",
    title: "Hotel starter",
    text: "A full site: pnpm create web4kit --template hotel",
  },
  { href: "/stats", title: "Stats", text: "Cache hits, tokens and cost per page." },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // One call: context -> situation -> one planning round (or a cache hit) -> fresh data.
  const page = await site.page({ searchParams });

  return (
    <>
      <PreviewBar site={site} page={page} statsHref="/stats" />
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:py-16">
        <header className="flex flex-col gap-4">
          <p className="font-mono text-sm tracking-tight">
            <span className="rounded-md bg-muted px-2 py-1 font-semibold">web4</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Get started by editing{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              web4/sources.ts
            </code>
            . Planned by <span className="font-mono">{page.plan.engine}</span>
            {page.cacheHit ? " (plan cache hit)" : ` in ${Math.round(page.planningMs)} ms`}.
          </p>
        </header>

        <PlanView
          plan={page.plan}
          data={page.data}
          manifests={site.manifests}
          registry={registry}
        />

        <footer className="grid gap-3 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group rounded-xl border border-transparent px-4 py-3 transition-colors hover:border-border hover:bg-muted"
            >
              <h2 className="font-semibold">
                {l.title}{" "}
                <span className="inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{l.text}</p>
            </a>
          ))}
        </footer>
      </main>
      {/* Development only: hover or tap a block to see why it is there. */}
      <XRay
        plan={page.plan}
        data={page.data}
        manifests={site.manifests}
        registry={registry}
        calibration={site.planner.calibrationStatus}
      />
    </>
  );
}
