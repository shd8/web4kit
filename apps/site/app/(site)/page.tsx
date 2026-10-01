import Link from "next/link";
import { TryIt } from "@/components/try-it";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Pages that decide themselves.
        </h1>
        <p className="text-lg text-fd-muted-foreground">
          web4kit asks a System One decision model what to show each visitor, with which component
          and where, from their situation alone. Calibration decides which answers are trusted, and
          invariants keep every page whole.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/playground"
          className="rounded-full bg-fd-primary px-5 py-2.5 text-sm font-semibold text-fd-primary-foreground"
        >
          Open the playground
        </Link>
        <Link
          href="/docs/getting-started"
          className="rounded-full border border-fd-border px-5 py-2.5 text-sm font-semibold"
        >
          Read the docs
        </Link>
      </div>
      <TryIt />
    </main>
  );
}
