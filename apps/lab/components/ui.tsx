"use client";

import type { ReactNode } from "react";

export const cx = (...p: Array<string | false | null | undefined>) => p.filter(Boolean).join(" ");

export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="border-b border-zinc-200 px-4 py-4 last:border-0 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-code text-[0.68rem] font-medium uppercase tracking-[0.14em] text-zinc-500">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        {value !== undefined && (
          <span className="font-code text-zinc-500 tabular-nums">{value}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  disabled,
}: {
  options: ReadonlyArray<{ id: T; label: string; disabled?: boolean; title?: string }>;
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  return (
    <fieldset className="m-0 flex w-full min-w-0 rounded-lg border-0 bg-zinc-200/70 p-0.5 dark:bg-zinc-800">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          disabled={disabled || o.disabled}
          title={o.title}
          onClick={() => onChange(o.id)}
          className={cx(
            "flex-1 rounded-md px-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            size === "sm" ? "py-1 text-xs" : "py-1.5 text-sm",
            value === o.id
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-600 dark:text-white"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
          )}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-orange-600 dark:bg-zinc-800"
    />
  );
}

export function Chip({
  children,
  tone = "zinc",
}: {
  children: ReactNode;
  tone?: "zinc" | "orange" | "green" | "amber" | "blue" | "red";
}) {
  const tones = {
    zinc: "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    blue: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    red: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-code text-[0.7rem]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
