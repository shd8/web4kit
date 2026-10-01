import Link from "next/link";
import { LaunchVideo } from "@/components/launch-video";
import { TryIt } from "@/components/try-it";

const MORE = [
  {
    href: "/thesis",
    title: "The thesis",
    text: "System One for UI: why selection beats generation, and what the evidence does and doesn't show.",
  },
  {
    href: "/bench",
    title: "web4-bench",
    text: "The open benchmark, and a challenge: a small open engine as good as Jev.",
  },
  { href: "/faq", title: "FAQ", text: "If/else? Google? Lock-in? Dark patterns? Forms?" },
];

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
      <LaunchVideo />
      <nav aria-label="Read more" data-home-more="" className="grid gap-3 sm:grid-cols-3">
        {MORE.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-fd-border p-4 hover:bg-fd-accent"
          >
            <span className="block font-semibold">{m.title}</span>
            <span className="text-sm text-fd-muted-foreground">{m.text}</span>
          </Link>
        ))}
      </nav>
      <TryIt />
    </main>
  );
}
