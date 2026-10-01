"use client";

import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState } from "react";
import {
  type SiteId,
  siteQuery,
  situationsQuery,
  THEMES,
  type Values,
  viewQuery,
} from "@/lib/playground/bundle";
import { EmbedView } from "./embed-view";

/** One client per page: every embed shares the bundles it has loaded. */
let shared: QueryClient | undefined;

export interface SituationEmbedProps {
  site: SiteId;
  /** Persona whose control values the embed starts from. */
  persona: string;
  /** The one control the reader can change (design D7), and the values offered. */
  control: string;
  options: string[];
  focus?: string;
  showSituation?: boolean;
  showWhy?: boolean;
}

export function SituationEmbed(props: SituationEmbedProps) {
  const [client] = useState(() => {
    shared ??= new QueryClient();
    return shared;
  });
  return (
    <QueryClientProvider client={client}>
      <Embed {...props} />
    </QueryClientProvider>
  );
}

function Embed({
  site,
  persona,
  control,
  options,
  focus,
  showSituation,
  showWhy,
}: SituationEmbedProps) {
  const qc = useQueryClient();
  const scope = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const [choice, setChoice] = useState(options[0]!);
  const { data: bundle } = useQuery(siteQuery(site));
  const base = bundle?.index.personas.find((p) => p.name === persona)?.values;
  const values: Values | undefined = base ? { ...base, [control]: choice } : undefined;
  // Keep showing the previous plan while the next one loads (no flash between choices).
  const { data: view } = useQuery({
    ...viewQuery(qc, site, values ?? {}),
    enabled: !!values,
    placeholderData: keepPreviousData,
  });
  const { data: situations } = useQuery({ ...situationsQuery(site), enabled: !!showSituation });
  const spec = bundle?.index.controls.find((c) => c.id === control);

  return (
    <figure
      className="not-prose my-6 flex flex-col gap-3 rounded-xl border border-fd-border p-4"
      data-embed={site}
    >
      <fieldset className="flex flex-wrap items-center gap-2 text-sm">
        <legend className="sr-only">{spec?.label ?? control}</legend>
        <span className="font-medium">{spec?.label ?? control}</span>
        {options.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === choice}
            data-embed-option={value}
            onClick={() => setChoice(value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              value === choice
                ? "border-fd-primary bg-fd-primary text-fd-primary-foreground"
                : "border-fd-border hover:bg-fd-accent"
            }`}
          >
            {spec?.options.find((o) => o.value === value)?.label ?? value}
          </button>
        ))}
      </fieldset>
      {bundle && view ? (
        <EmbedView
          scope={scope}
          plan={view.plan}
          data={view.data}
          manifests={bundle.manifests}
          theme={THEMES[site]}
          focus={focus}
          situation={showSituation ? situations?.[view.planHash] : undefined}
          showWhy={showWhy}
        />
      ) : (
        <p className="text-sm text-fd-muted-foreground">Loading the precomputed plan…</p>
      )}
      <figcaption className="text-xs text-fd-muted-foreground">
        A real plan Jev made once for this situation, ahead of time.{" "}
        <Link href={`/playground/?site=${site}`} className="underline">
          Open in the playground
        </Link>
      </figcaption>
    </figure>
  );
}
