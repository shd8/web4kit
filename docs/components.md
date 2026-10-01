# Your own components

The planner chooses, for each source, one of the components whose manifest accepts that source's data. The library ships seventeen. When none says what you want, add your own: the planner treats them exactly like the library's.

## Generate one

```bash
pnpm web4kit add component quote-card --shape record --what "A short quote from a guest, set large"
```

This writes two files and registers the component:

- `web4/components/quote-card.tsx`: the manifest, the props schema, and the markup.
- `web4/components/quote-card.test.ts`: validates the manifest and renders sample data.
- `web4/components/index.ts`: the import and the list entry are added at the `// web4kit:` marker lines. Keep those lines.

Reload the page. Every `record` source whose fields cover the component's required roles now offers `quote-card` in its component question. The X-ray shows which component was chosen and by whom. A new component changes the question for those sources, so their calibration becomes stale. They're ungated in dev until you run `pnpm calibrate`.

The command refuses invalid names (use kebab-case) and ids that already exist, including the library's. It also refuses when a file is already there or the markers are missing. In each case it changes nothing.

## The manifest is the contract

```ts
export const quoteCard = defineComponent({
  manifest: {
    id: "quote-card",
    what: "A short quote from a guest, set large",
    accepts: [{ shape: "record", requires: ["title"] }],
    affordances: ["highlight"],
    footprint: {
      mobile: { colSpan: 12, rowSpan: 1 },
      tablet: { colSpan: 12, rowSpan: 1 },
      desktop: { colSpan: 6, rowSpan: 1 },
    },
    mediaHeavy: false,
  },
  props: z.object({ title: z.string(), body: z.string().optional() }),
  toProps: (data, binding) => bindRecord(data, binding),
  render: (p, ctx) => <Card>…</Card>,
});
```

- **`what` is a prompt.** The model reads it literally when choosing a component for a source. Say what the component *shows* and when it's the right choice ("a short quote, set large"), not how it's built. Editing it later makes the sources offered this component stale, like editing a source's `what`.
- **`accepts` decides where it's offered.** `shape` is the data shape (`list`, `record`, `media-list`, `schedule`, `geo`, `timeseries`, `graph`). `requires` names the roles a source must bind in its `fields`. A source without a `title` role never sees a component that requires it. When there are several compatible components, `rank` (lower first) picks the default.
- **`footprint` is per device.** It sets columns out of 12 and rows. The layout solver uses it, and the renderer gives the block exactly that space, so design for it at every device.
- **`mediaHeavy` components need a `fallback`.** Visitors with Save-Data on get the fallback component instead.

## Props and fail-soft rendering

`toProps` maps the source's data through the plan's role → field binding. `bindRecord` and `bindList` from `@web4kit/react` do the usual cases. The canonical shapes (`schedule`, `geo`, `timeseries`, `graph`) arrive already in their schema, so use `ScheduleDataSchema` and its siblings from `@web4kit/manifest` as `props`. Props are validated before every render. If validation fails, or the render throws, the block falls back to the source's default component. Neither the page nor the plan breaks, and the X-ray shows the fallback and why.

Use the library's primitives (`Card`, `Heading`, `Badge`) and design tokens (`bg-card`, `text-muted-foreground`, …) so your components match the rest of the page in both themes.
