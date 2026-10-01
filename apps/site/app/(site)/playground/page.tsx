import type { Metadata } from "next";
import { Playground } from "@/components/playground/playground";

export const metadata: Metadata = {
  title: "Playground",
  description: "Change the visitor's situation and watch web4 re-plan the page.",
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Playground</h1>
        <p className="text-fd-muted-foreground">
          Change who's visiting and watch the page re-plan. Every view is a real plan Jev made once,
          ahead of time; turn on the X-ray (bottom right) to see every decision.
        </p>
      </header>
      <Playground />
    </main>
  );
}
