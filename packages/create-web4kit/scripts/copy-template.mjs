// Copies templates/* into ./template/<name> so the published package is self-contained.
import { cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { copyTemplate, TEMPLATES } from "../lib.mjs";

const here = resolve(import.meta.dirname, "..");
const target = resolve(here, "template");
rmSync(target, { recursive: true, force: true });
for (const name of TEMPLATES) {
  copyTemplate(resolve(here, "../../templates", name), resolve(target, name), cpSync);
}
console.log(`templates copied to ${target}: ${TEMPLATES.join(", ")}`);
