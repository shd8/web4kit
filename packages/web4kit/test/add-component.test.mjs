import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { addComponent } from "../lib/add-component.mjs";

// Inside the package, so the copy resolves @web4kit/react from this package's node_modules.
const scratch = resolve(import.meta.dirname, "../.tmp");
mkdirSync(scratch, { recursive: true });
after(() => rmSync(scratch, { recursive: true, force: true }));
const welcome = resolve(import.meta.dirname, "../../../templates/welcome/web4/components");

/** A temp site holding a copy of the welcome starter's component list. */
function site() {
  const dir = mkdtempSync(join(scratch, "site-"));
  cpSync(welcome, join(dir, "web4/components"), { recursive: true });
  writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n');
  return dir;
}
const snapshot = (dir) => {
  const c = join(dir, "web4/components");
  return Object.fromEntries(readdirSync(c).map((f) => [f, readFileSync(join(c, f), "utf8")]));
};
const quiet = { log: console.log };
const silence = () => {
  console.log = () => {};
};
after(() => {
  console.log = quiet.log;
});

describe("web4kit add component", () => {
  it("creates the component and its test, and registers it", async () => {
    const dir = site();
    silence();
    assert.equal(await addComponent({ name: "quote-card", shape: "record", cwd: dir }), 0);
    const files = snapshot(dir);
    assert.ok(files["quote-card.tsx"].includes('id: "quote-card"'));
    assert.ok(
      files["quote-card.tsx"].includes('accepts: [{ shape: "record", requires: ["title"] }]'),
    );
    assert.ok(files["quote-card.test.ts"].includes("renders sample data"));
    const index = files["index.ts"];
    assert.ok(index.includes('import { quoteCard } from "./quote-card";\n// web4kit:imports'));
    assert.ok(index.includes("quoteCard,\n  // web4kit:components"));
  });

  it("supports every shape", async () => {
    silence();
    for (const shape of ["list", "media-list", "schedule", "geo", "timeseries", "graph"]) {
      const dir = site();
      assert.equal(await addComponent({ name: `my-${shape}`, shape, cwd: dir }), 0);
      assert.ok(snapshot(dir)[`my-${shape}.tsx`].includes(`shape: "${shape}"`));
    }
  });

  const unchanged = async (options, message, prepare = () => {}) => {
    const dir = site();
    prepare(dir);
    const before = snapshot(dir);
    await assert.rejects(addComponent({ cwd: dir, ...options }), message);
    assert.deepEqual(snapshot(dir), before);
  };

  it("refuses a library id, changing no files", () =>
    unchanged({ name: "record-card" }, /"record-card" already exists/));

  it("refuses bad names and shapes, changing no files", async () => {
    await unchanged({ name: "QuoteCard" }, /not a valid component id/);
    await unchanged({ name: "quote_card" }, /not a valid component id/);
    await unchanged({ name: "quote-card", shape: "table" }, /unknown shape/);
  });

  it("refuses when the registration marker is missing, changing no files", () =>
    unchanged({ name: "quote-card" }, /no "\/\/ web4kit:components" line/, (dir) => {
      const index = join(dir, "web4/components/index.ts");
      writeFileSync(index, readFileSync(index, "utf8").replace("// web4kit:components", ""));
    }));

  it("refuses an existing file, changing no files", () =>
    unchanged({ name: "quote-card" }, /quote-card\.tsx already exists/, (dir) =>
      writeFileSync(join(dir, "web4/components/quote-card.tsx"), "// mine\n"),
    ));
});
