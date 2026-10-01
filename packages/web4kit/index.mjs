#!/usr/bin/env node
// web4kit: the developer CLI of a web4 site (run inside the site, e.g. `pnpm web4kit check`).
import { addComponent } from "./lib/add-component.mjs";
import { check } from "./lib/check.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));

const USAGE = `Usage: web4kit <command>

  check [--site web4/site.ts] [--strict]
      Report whether the configured engine's calibration profile matches your sources.
      --strict exits with an error unless it is active (for CI).

  add component <name> [--shape record] [--what "..."] [--dir web4/components]
      Scaffold a component (manifest, props, render) and its test, and register it so the
      planner can choose it on the next reload. Shapes: list, record, media-list, schedule,
      geo, timeseries, graph.`;

const [command, sub, name] = positional;
try {
  if (!command || args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    process.exit(command ? 0 : 1);
  }
  if (command === "check") {
    process.exit(await check({ site: flag("--site"), strict: args.includes("--strict") }));
  }
  if (command === "add" && sub === "component") {
    process.exit(
      await addComponent({
        name,
        shape: flag("--shape"),
        what: flag("--what"),
        dir: flag("--dir"),
      }),
    );
  }
  console.error(`✖ unknown command "${positional.join(" ")}"\n\n${USAGE}`);
  process.exit(1);
} catch (e) {
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
