import { defineManifests, defineSource, owner, system } from "@web4kit/manifest";
import { libraryManifests } from "@web4kit/react";

/**
 * Your data sources. web4 decides, per visitor, which of these to show, with which component,
 * where and how prominently. `what` and `audience` are the prompt: the model reads them
 * literally. Heuristics make the offline rules engine (used without a JEV_API_KEY) a good page.
 *
 * Try it: edit a `what`, add a source, or change an `audience`, then reload.
 */
export const manifests = defineManifests({
  site: "my-web4-site",
  components: libraryManifests,
  sources: [
    defineSource({
      id: "welcome",
      shape: "record",
      label: "Welcome",
      eyebrow: "Planned for you, just now",
      tags: ["welcome", "introduction"],
      what: "The welcome message introducing web4 to every visitor; the most important block",
      fields: { title: owner("title"), body: owner("body") },
      default: { salience: "featured", region: "hero", prominence: 2, component: "record-card" },
      mustInclude: {}, // an empty condition always holds: every visitor is welcomed
      fetch: async () => ({
        title: "Welcome to web4",
        body: "Nobody laid this page out. web4 asked a System One model what to show you, with which component and where, from your situation alone. Change the situation and the page changes.",
      }),
    }),
    defineSource({
      id: "get-started",
      shape: "list",
      label: "Get started",
      eyebrow: "Four steps",
      tags: ["getting started", "main content", "for everyone"],
      what: "How to get started with web4 in four steps; the main content of this page, relevant to every visitor",
      fields: { title: owner("title"), date: owner("step"), subtitle: owner("detail") },
      default: { salience: "featured", prominence: 2, component: "events-timeline" },
      fetch: async () => [
        {
          step: "Step 1",
          title: "Edit web4/sources.ts",
          detail: "Each source says what it is and who it is for. Save and reload.",
        },
        {
          step: "Step 2",
          title: "Preview other visitors",
          detail: "Use the bar at the top, or /?as=from-instagram and /?as=night-owl.",
        },
        {
          step: "Step 3",
          title: "Plan with Jev",
          detail: "Add JEV_API_KEY to .env. Without it, the offline rules engine plans the page.",
        },
        {
          step: "Step 4",
          title: "Measure it",
          detail: "pnpm test checks your page rules; pnpm calibrate measures Jev on your personas.",
        },
      ],
    }),
    defineSource({
      id: "your-situation",
      shape: "list",
      label: "What web4 knows about you",
      eyebrow: "The only input the model sees",
      tags: ["situation", "context", "transparency"],
      what: "The visitor's situation labels this page was planned from, as a small table",
      fields: { title: system("bucket"), value: system("label") },
      default: { salience: "standard", region: "aside", prominence: 1, component: "data-table" },
      heuristics: [{ when: { device: ["mobile"] }, salience: "minor", region: "secondary" }],
      // Fetchers receive the label-only situation: show it back to the visitor.
      fetch: async (ctx) =>
        Object.entries(ctx.situation ?? {}).map(([bucket, label]) => ({ bucket, label })),
    }),
    defineSource({
      id: "from-social",
      shape: "record",
      label: "Hello from Instagram",
      tags: ["social", "arrival"],
      what: "A note for visitors who arrived from a social or visual app such as Instagram",
      audience: { arrival: ["visual"] },
      fields: { title: owner("title"), body: owner("body") },
      default: { include: false, component: "record-card" },
      heuristics: [{ when: { arrival: ["visual"] }, relevant: true, prominence: 2 }],
      fetch: async () => ({
        title: "You came from a visual app",
        body: "arrival is visual, so web4 moved this note up. A real site would lead with photos here: add a media-list source and see.",
      }),
    }),
    defineSource({
      id: "on-mobile",
      shape: "record",
      label: "On your phone",
      tags: ["mobile", "device"],
      what: "A short note for visitors on a phone about how the page adapts to small screens",
      audience: { device: ["mobile"] },
      fields: { title: owner("title"), body: owner("body") },
      default: { include: false, salience: "minor", region: "secondary", prominence: 0 },
      heuristics: [{ when: { device: ["mobile"] }, relevant: true }],
      fetch: async () => ({
        title: "One column, short blocks",
        body: "device is mobile: the steps come first and the situation table moved down.",
      }),
    }),
    defineSource({
      id: "late-night",
      shape: "record",
      label: "Up late?",
      tags: ["night", "time"],
      what: "A friendly note for visitors browsing at night",
      audience: { dayPart: ["night"] },
      fields: { title: owner("title"), body: owner("body") },
      default: { include: false, salience: "minor", region: "secondary", prominence: 0 },
      heuristics: [{ when: { dayPart: ["night"] }, relevant: true, salience: "standard" }],
      fetch: async () => ({
        title: "Coding at night",
        body: "dayPart is night in your time zone, so this block exists. Come back in the morning and it won't.",
      }),
    }),
  ],
});
