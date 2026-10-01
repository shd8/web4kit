// Runs inside the site (under tsx): import a module and print one marked JSON line.
import { pathToFileURL } from "node:url";

const MARKER = "\u0000web4kit:";
const [mode, file] = process.argv.slice(2);
const out = (value) => {
  process.stdout.write(`\n${MARKER}${JSON.stringify(value)}\n`);
  process.exit(0);
};

try {
  const mod = await import(pathToFileURL(file).href);
  if (mode === "site") {
    const site = mod.site ?? mod.default;
    if (typeof site?.calibrationReport !== "function")
      out({ error: `${file} must export the site created with createSite (as \`site\`)` });
    out({ report: site.calibrationReport() });
  }
  if (mode === "components") {
    const list = mod.components;
    if (!Array.isArray(list)) out({ error: `${file} must export \`components\`` });
    out({ ids: list.map((c) => c?.manifest?.id).filter(Boolean) });
  }
  out({ error: `unknown mode ${mode}` });
} catch (e) {
  out({ error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
}
