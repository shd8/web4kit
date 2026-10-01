import { PreviewBar } from "@web4kit/next";
import { PlanView } from "@web4kit/react";
import { XRay } from "@web4kit/react/xray";
import { registry } from "@/web4/components";
import { HOTEL } from "@/web4/hotel";
import { site } from "@/web4/site";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await site.page({ searchParams });

  return (
    <>
      <PreviewBar site={site} page={page} statsHref="/stats" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <a href="/" className="font-display text-2xl font-semibold tracking-tight">
          {HOTEL.name}
        </a>
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
          manifests={site.manifests}
          registry={registry}
        />
      </main>
      {/* Development only: hover or tap a block to see why it is there. */}
      <XRay
        plan={page.plan}
        data={page.data}
        manifests={site.manifests}
        registry={registry}
        calibration={site.planner.calibrationStatus}
      />
      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {HOTEL.address} · {HOTEL.phone}
        <br />
        <span className="text-xs">This page was planned for your situation by web4.</span>
      </footer>
    </>
  );
}
