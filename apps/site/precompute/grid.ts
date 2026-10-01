import type { ContextEnvelope, Situation } from "@web4kit/context";
import { localClock } from "@web4kit/context";

/**
 * A demo site's playground controls (design D1). The precompute walks the cross product of the
 * option values, so every combination the playground can show is planned in advance.
 */
export interface ControlOption {
  value: string;
  label: string;
}
export interface Control {
  id: string;
  label: string;
  options: ControlOption[];
}
export type ControlValues = Record<string, string>;

export interface Persona {
  name: string;
  title: string;
  /** Control values the preset sets. */
  values: ControlValues;
  /** The persona's own envelope (fixtures): its preset must derive the same situation. */
  envelope: ContextEnvelope;
}

export interface Grid {
  site: "restaurant" | "hotel" | "welcome";
  title: string;
  /** Order defines the index dimensions. */
  controls: Control[];
  personas: Persona[];
  envelope(values: ControlValues): ContextEnvelope;
  situationOf(envelope: ContextEnvelope): Situation;
}

/** The demo week: Monday 2026-09-28 to Sunday 2026-10-04 (the personas' dates fall in it). */
export const DEMO_DAYS: ControlOption[] = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 8, 28 + i));
  return {
    value: date.toISOString().slice(0, 10),
    label: date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" }),
  };
});

/** Times every `step` minutes, plus extra times (e.g. the personas'), sorted and unique. */
export function timeOptions(step: number, extra: string[] = []): ControlOption[] {
  const values = new Set(extra);
  for (let m = 0; m < 1440; m += step) values.add(hhmm(m));
  return [...values].sort().map((value) => ({ value, label: value }));
}

export const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** UTC instant of a local date and time in a time zone. */
export function localInstant(date: string, time: string, timeZone: string): string {
  const [h, m] = time.split(":").map(Number);
  const target = h! * 60 + m!;
  // Noon UTC is the same calendar day in the demo zones (Europe); shift by the local offset.
  const noon = new Date(`${date}T12:00:00Z`);
  const clock = localClock(noon, timeZone);
  return new Date(noon.getTime() + (target - clock.minutes) * 60_000).toISOString();
}

/** Local date and time of an instant, for matching personas to options. */
export function localDateTime(iso: string, timeZone: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
  return { date, time: hhmm(localClock(d, timeZone).minutes) };
}

/** Every combination of control values, in a fixed order (first control varies slowest). */
export function* combinations(controls: Control[]): Generator<ControlValues> {
  const idx = controls.map(() => 0);
  const total = controls.reduce((n, c) => n * c.options.length, 1);
  for (let k = 0; k < total; k++) {
    yield Object.fromEntries(controls.map((c, i) => [c.id, c.options[idx[i]!]!.value]));
    for (let i = controls.length - 1; i >= 0; i--) {
      idx[i]!++;
      if (idx[i]! < controls[i]!.options.length) break;
      idx[i] = 0;
    }
  }
}

export const comboCount = (controls: Control[]) =>
  controls.reduce((n, c) => n * c.options.length, 1);

export const BASE_ENVELOPE: Omit<ContextEnvelope, "now"> = {
  utm: {},
  languages: ["en-GB"],
  device: "mobile",
  saveData: false,
  consent: false,
};
