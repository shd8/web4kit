import type { ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Every block renders inside a Card: consistent radius, border, padding and overflow rules. */
const CARD_TONES = {
  default: "border-border bg-card text-card-foreground",
  inverse: "border-transparent bg-foreground text-background",
  primary: "border-transparent bg-primary text-primary-foreground",
} as const;

export function Card({
  children,
  className,
  flush,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
  tone?: keyof typeof CARD_TONES;
}) {
  return (
    <section
      className={cx(
        "h-full min-w-0 overflow-hidden rounded-[var(--radius-card)] border",
        CARD_TONES[tone],
        !flush && "p-5 @lg:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Heading({
  label,
  eyebrow,
  aside,
}: {
  label: string;
  eyebrow?: string | undefined;
  aside?: ReactNode;
}) {
  return (
    <header className="mb-4 flex min-w-0 items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="truncate font-display text-xl leading-tight tracking-tight @lg:text-2xl">
          {label}
        </h2>
      </div>
      {aside}
    </header>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "ok" | "warn" | "bad";
}) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    primary: "bg-primary text-primary-foreground",
    ok: "bg-ok/15 text-ok",
    warn: "bg-warn/20 text-foreground",
    bad: "bg-bad/15 text-bad",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone }: { tone: "ok" | "warn" | "bad" }) {
  const color = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" }[tone];
  return <span aria-hidden className={cx("inline-block size-2 rounded-full", color)} />;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline";
}) {
  return (
    <a
      href={href}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "border border-border bg-card hover:bg-muted",
      )}
    >
      {children}
    </a>
  );
}

export function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : undefined;
}
