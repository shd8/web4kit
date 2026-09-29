import { defaultRegistry, PlanView } from "@web4kit/react";
import { headers } from "next/headers";
import Link from "next/link";
import { PERSONAS } from "@/web4/fixtures";
import { HOTEL } from "@/web4/hotel";
import { manifests, pageFor } from "@/web4/server";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const h = await headers();
  const query = new URLSearchParams(
    Object.entries(await searchParams).filter(
      (e): e is [string, string] => typeof e[1] === "string",
    ),
  );
  const page = await pageFor({
    url: `http://${h.get("host") ?? "localhost"}/?${query}`,
    headers: h,
  });
  const dev = process.env.NODE_ENV !== "production";

  return (
    <>
      {dev && (
        <nav className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">
            Preview as
          </span>
          <Link
            href="/"
            className={`rounded-full px-2.5 py-1 ${!page.persona ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            Your real request
          </Link>
          {PERSONAS.map((p) => (
            <Link
              key={p.name}
              href={`/?as=${p.name}`}
              className={`rounded-full px-2.5 py-1 ${page.persona === p.name ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              {p.title}
            </Link>
          ))}
          <span className="ml-auto font-mono text-muted-foreground">
            {page.plan.engine} ·{" "}
            {page.cacheHit ? "plan cache hit" : `planned in ${Math.round(page.planningMs)} ms`} ·{" "}
            <Link href="/stats" className="underline">
              stats
            </Link>
          </span>
        </nav>
      )}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
          {HOTEL.name}
        </Link>
        <a
          href="#rooms"
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Book direct
        </a>
      </header>
      <main className="px-3 pb-10 sm:px-4">
        <PlanView
          plan={page.plan}
          data={page.data}
          manifests={manifests}
          registry={defaultRegistry}
        />
      </main>
      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {HOTEL.address} · {HOTEL.phone}
        <br />
        <span className="text-xs">This page was planned for your situation by web4.</span>
      </footer>
    </>
  );
}
