"use client";

import type { ContextEnvelope } from "@web4kit/context";
import {
  ARRIVALS,
  DAYS,
  DEVICES,
  formatKm,
  formatMinutes,
  getArrival,
  getClock,
  getDistance,
  getVisits,
  kmToSlider,
  LANGUAGES,
  ROLES,
  setArrival,
  setClock,
  setDistance,
  setVisits,
  sliderToKm,
  VISITS,
} from "@/lib/controls";
import type { LabExample } from "@/lib/examples";
import { cx, Field, Section, Segmented, Slider } from "./ui";

interface Props {
  example: LabExample;
  envelope: ContextEnvelope;
  onChange: (e: ContextEnvelope) => void;
  question: string;
  onQuestion: (q: string) => void;
}

const SUGGESTIONS = [
  "Which suppliers are late this month?",
  "What are our best selling products?",
  "Where is stock cover lowest?",
  "Show me the supply network",
  "¿Qué proveedores llegan tarde este mes?",
];

export function ContextPanel({ example, envelope, onChange, question, onQuestion }: Props) {
  const device = (
    <Field label="Device">
      <Segmented
        options={DEVICES.map((d) => ({ id: d, label: d[0]!.toUpperCase() + d.slice(1) }))}
        value={envelope.device === "unknown" ? "mobile" : envelope.device}
        onChange={(d) => onChange({ ...envelope, device: d })}
      />
    </Field>
  );

  if (!example.venue) {
    const role = envelope.roles?.[0] ?? "ops-manager";
    return (
      <Section title="Context">
        <Field label="Signed-in role">
          <Segmented
            options={ROLES}
            value={role as (typeof ROLES)[number]["id"]}
            onChange={(r) => onChange({ ...envelope, roles: [r] })}
          />
        </Field>
        {device}
        <Field label="Ask the data" value={question ? `${question.length}/280` : undefined}>
          <textarea
            value={question}
            maxLength={280}
            rows={2}
            placeholder="Optional: type a question…"
            onChange={(e) => onQuestion(e.target.value)}
            className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onQuestion(question === s ? "" : s)}
                className={cx(
                  "rounded-full border px-2.5 py-1 text-left text-[0.72rem] transition-colors",
                  question === s
                    ? "border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>
      </Section>
    );
  }

  const venue = example.venue;
  const clock = getClock(envelope, venue.timezone);
  const km = getDistance(envelope, venue);
  // Slider covers 06:00 .. 02:00 next day.
  const sliderMinutes = clock.minutes < 360 ? clock.minutes + 1440 : clock.minutes;

  return (
    <Section title="Context">
      <Field label="Arrived from">
        <div className="grid grid-cols-2 gap-1.5">
          {ARRIVALS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(setArrival(envelope, a.id))}
              className={cx(
                "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                getArrival(envelope) === a.id
                  ? "border-orange-500 bg-orange-50 text-orange-900 dark:bg-orange-950 dark:text-orange-100"
                  : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Local time" value={`${DAYS[clock.day]} ${formatMinutes(clock.minutes)}`}>
        <Slider
          label="Local time"
          value={sliderMinutes}
          min={360}
          max={1560}
          step={10}
          onChange={(m) => {
            // The slider spans one service day, 06:00 to 02:00 the next morning.
            const serviceDay = clock.minutes < 360 ? (clock.day + 6) % 7 : clock.day;
            onChange(
              setClock(
                envelope,
                venue.timezone,
                m >= 1440 ? (serviceDay + 1) % 7 : serviceDay,
                m % 1440,
              ),
            );
          }}
        />
        <div className="mt-2 flex gap-1">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange(setClock(envelope, venue.timezone, i, clock.minutes))}
              className={cx(
                "flex-1 rounded py-0.5 font-code text-[0.65rem]",
                clock.day === i
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Distance to venue" value={formatKm(km)}>
        <Slider
          label="Distance"
          value={km === undefined ? 50 : kmToSlider(km)}
          min={0}
          max={100}
          onChange={(v) => onChange(setDistance(envelope, venue, sliderToKm(v)))}
        />
      </Field>
      {device}
      <Field label="Visit memory">
        <Segmented
          options={VISITS}
          value={getVisits(envelope)}
          onChange={(v) => onChange(setVisits(envelope, v))}
        />
      </Field>
      <Field label="Language">
        <Segmented
          options={LANGUAGES.map((l) => ({ id: l.tag, label: l.label }))}
          value={
            (LANGUAGES.find((l) => envelope.languages[0]?.startsWith(l.tag.slice(0, 2)))?.tag ??
              "en-GB") as (typeof LANGUAGES)[number]["tag"]
          }
          onChange={(tag) => onChange({ ...envelope, languages: [tag] })}
        />
      </Field>
      <Field label="Data saver">
        <Segmented
          options={[
            { id: "off", label: "Off" },
            { id: "on", label: "On (Save-Data)" },
          ]}
          value={envelope.saveData ? "on" : "off"}
          onChange={(v) => onChange({ ...envelope, saveData: v === "on" })}
        />
      </Field>
    </Section>
  );
}
