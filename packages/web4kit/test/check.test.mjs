import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const bin = resolve(import.meta.dirname, "../index.mjs");
const fixture = resolve(import.meta.dirname, "fixture");
const run = (state, ...args) => {
  const r = spawnSync(process.execPath, [bin, "check", ...args], {
    cwd: fixture,
    encoding: "utf8",
    env: { ...process.env, FIXTURE: state },
  });
  return { code: r.status, out: r.stdout + r.stderr };
};

describe("web4kit check", () => {
  it("active: succeeds, also with --strict", () => {
    for (const args of [[], ["--strict"]]) {
      const r = run("active", ...args);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /fake-1\.0\.0 calibration is active/);
    }
  });

  it("partial: names the stale source and the fix; succeeds unless --strict", () => {
    const r = run("partial");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /partial: stale for offer/);
    assert.match(r.out, /pnpm calibrate/);
    assert.doesNotMatch(r.out, /must not call the decider/);
    assert.equal(run("partial", "--strict").code, 1);
  });

  it("missing: fails with --strict", () => {
    const r = run("missing", "--strict");
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /missing/);
    assert.match(r.out, /pnpm calibrate/);
  });

  it("rules only: nothing to calibrate, succeeds even with --strict", () => {
    const r = run("rules", "--strict");
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /rules engine; there is nothing to calibrate/);
  });

  it("explains a missing site module", () => {
    const r = run("rules", "--site", "web4/nope.ts");
    assert.equal(r.code, 1);
    assert.match(r.out, /web4\/nope\.ts not found/);
  });
});
