import { DEVICES } from "@web4kit/ir";
import { type BlockContext, LIBRARY } from "@web4kit/react";
import type { ReactElement } from "react";
import { SAMPLE } from "@/lib/samples";

export const metadata = { title: "web4 component gallery" };

const WIDTH = { mobile: 390, tablet: 820, desktop: 1200 } as const;

/** Every library component at every declared footprint and device class (task 8.2). */
export default function Gallery() {
  return (
    <main data-w4-theme="lumbre" className="space-y-10 bg-background p-6 text-foreground">
      {LIBRARY.map((entry) => {
        const sample = SAMPLE[entry.manifest.accepts[0]!.shape]!;
        const props = entry.props.parse(entry.toProps(sample.data, sample.binding));
        return (
          <section key={entry.manifest.id} data-gallery-component={entry.manifest.id}>
            <h2 className="mb-3 font-code text-sm">{entry.manifest.id}</h2>
            <div className="space-y-4">
              {DEVICES.map((device) => {
                const footprint = entry.manifest.footprint[device];
                const width = Math.round(
                  (WIDTH[device] * (device === "mobile" ? 12 : footprint.colSpan)) / 12,
                );
                const ctx: BlockContext = {
                  label: "Sample heading",
                  eyebrow: "Eyebrow",
                  footprint,
                  device,
                };
                return (
                  <div
                    key={device}
                    data-gallery-case={`${entry.manifest.id}@${device}`}
                    className="@container"
                    style={{ width }}
                  >
                    {(entry.render as (p: unknown, c: BlockContext) => ReactElement)(props, ctx)}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
