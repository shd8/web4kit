// Publishability smoke test: pack every library package exactly as `npm publish` would, install
// the tarballs into a clean project outside the workspace, type-check it with TypeScript 5.9
// and run it with plain Node. Fails if exports, types or dependencies are broken.
//
//   node scripts/smoke.mjs                         local tarballs (CI)
//   node scripts/smoke.mjs --from-npm 0.2.0        the published version, after a release
//   options: --registry <url> (default: npm's)  --no-starter
//
// With --from-npm every package comes from the registry (waiting up to 5 minutes for the version
// to appear) and starters are made with `pnpm create web4kit@<version>`. Every check after the
// install is shared with the tarball mode.
import { execSync, spawn } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const root = resolve(import.meta.dirname, "..");
const PACKAGES = [
  "ir",
  "decider",
  "context",
  "manifest",
  "planner",
  "solver",
  "react",
  "conformance",
  "next",
  "decider-laya",
  "create-web4kit",
  "web4kit",
];
const { values: args } = parseArgs({
  options: {
    "from-npm": { type: "string" },
    registry: { type: "string" },
    "no-starter": { type: "boolean", default: false },
  },
});
const published = args["from-npm"];
if (args.registry) process.env.npm_config_registry = args.registry;
const work = mkdtempSync(join(tmpdir(), "web4kit-smoke-"));
const packDir = join(work, "pack");
const app = join(work, "app");
mkdirSync(packDir);
mkdirSync(app);
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });

try {
  const manifests = PACKAGES.map((p) =>
    JSON.parse(readFileSync(join(root, "packages", p, "package.json"), "utf8")),
  );
  if (published) {
    await waitForRegistry(manifests.map((m) => `${m.name}@${published}`));
    // The registry's own tarballs: the entry-point check below then inspects what npm serves.
    for (const { name } of manifests)
      run(`npm pack ${name}@${published} --pack-destination ${packDir} --silent`, work);
  } else {
    for (const p of PACKAGES)
      run(`pnpm pack --pack-destination ${packDir}`, join(root, "packages", p));
  }
  const version = (m) => published ?? m.version;
  // Tarball per package name (both tools name them <scope>-<name>-<version>.tgz).
  const tarballs = Object.fromEntries(
    manifests.map((m) => {
      const file = `${m.name.replace(/^@/, "").replace("/", "-")}-${version(m)}.tgz`;
      const key = m.name === "create-web4kit" ? "@web4kit/create-web4kit" : m.name;
      return [key, `file:${join(packDir, file)}`];
    }),
  );
  // Every file a packed package.json points at (main, types, exports, bin) must be in the tarball.
  for (const [name, spec] of Object.entries(tarballs)) {
    const file = spec.replace("file:", "");
    const listing = new Set(
      execSync(`tar -tzf ${file}`, { encoding: "utf8" })
        .split("\n")
        .map((l) => l.replace(/^package\//, "")),
    );
    const manifest = JSON.parse(
      execSync(`tar -xzOf ${file} package/package.json`, { encoding: "utf8" }),
    );
    const targets = [];
    const collect = (v) =>
      typeof v === "string"
        ? targets.push(v)
        : v && typeof v === "object" && Object.values(v).forEach(collect);
    collect([manifest.main, manifest.types, manifest.exports, manifest.bin]);
    const missing = targets
      .map((t) => t.replace(/^\.\//, ""))
      .filter((t) => t !== "package.json" && !listing.has(t));
    if (missing.length) throw new Error(`${name}: tarball lacks ${missing.join(", ")}`);
  }
  console.log("✓ every packed entry point exists in its tarball");
  const scaffolder = tarballs["@web4kit/create-web4kit"];
  delete tarballs["@web4kit/create-web4kit"];
  // decider-laya pulls onnxruntime and next needs a Next app: both are packed, not installed here.
  const {
    "@web4kit/decider-laya": _laya,
    "@web4kit/next": _next,
    web4kit: _cli,
    ...deps
  } = tarballs;
  // From npm the app depends on the published version and resolves everything from the registry.
  const specs = published
    ? Object.fromEntries(Object.keys(deps).map((name) => [name, published]))
    : deps;
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify(
      {
        name: "web4kit-smoke",
        private: true,
        type: "module",
        dependencies: { ...specs, react: "^19.3.0", "react-dom": "^19.3.0" },
        ...(published ? {} : { overrides: tarballs }),
        devDependencies: {
          typescript: "~5.9.2",
          "@types/react": "^19.3.0",
          "@types/react-dom": "^19",
          "@types/node": "^22",
        },
      },
      null,
      2,
    ),
  );
  cpSync(join(root, "scripts/smoke/site.ts"), join(app, "site.ts"));
  cpSync(join(root, "scripts/smoke/tsconfig.json"), join(app, "tsconfig.json"));
  run("npm install --no-audit --no-fund --loglevel=error", app);
  run("npx tsc -p tsconfig.json", app);
  run("node site.ts", app);
  console.log(
    `\n✓ library smoke passed: ${published ? `npm ${published}` : "packed"} packages install, type-check (TS 5.9) and run`,
  );

  // Starters: scaffold each template from the packed create-web4kit, install the tarballs,
  // build and serve in production mode.
  if (!args["no-starter"]) {
    const tool = join(work, "tool");
    mkdirSync(tool);
    if (!published) run(`tar -xzf ${scaffolder.replace("file:", "")} -C ${tool}`, work);
    const STARTERS = [
      // Production must ignore ?as= previews: the real request (?src=instagram) is planned.
      {
        template: "welcome",
        query: "?src=instagram&as=night-owl",
        want: ["welcome", "get-started", "from-social"],
        never: ["late-night"],
      },
      {
        template: "hotel",
        query: "?src=instagram&as=arriving-today",
        want: ["hero-photos", "rooms"],
        never: ["arrival-guide"],
      },
    ];
    for (const [i, starter] of STARTERS.entries()) {
      const site = join(work, `site-${starter.template}`);
      const flags = starter.template === "welcome" ? "" : ` --template ${starter.template}`;
      if (published) {
        // What a stranger runs; the site's @web4kit ranges resolve from the registry.
        run(`pnpm create web4kit@${published} ${site}${flags}`, work);
      } else {
        run(`node ${join(tool, "package/index.mjs")} ${site}${flags}`, work);
        const sitePkgPath = join(site, "package.json");
        const sitePkg = JSON.parse(readFileSync(sitePkgPath, "utf8"));
        sitePkg.pnpm = { overrides: tarballs };
        for (const field of ["dependencies", "devDependencies"]) {
          for (const name of Object.keys(sitePkg[field] ?? {}))
            if (tarballs[name]) sitePkg[field][name] = tarballs[name];
        }
        writeFileSync(sitePkgPath, JSON.stringify(sitePkg, null, 2));
      }
      // pnpm is the documented default for starters.
      run("pnpm install --reporter=silent", site);
      run("pnpm exec tsc --noEmit -p tsconfig.json", site);
      run("pnpm test", site);
      run("pnpm build", site);
      // tailwind.css must let the app's Tailwind build see the component library's classes.
      const cssDir = join(site, ".next/static");
      const css = readdirSync(cssDir, { recursive: true })
        .filter((f) => String(f).endsWith(".css"))
        .map((f) => readFileSync(join(cssDir, String(f)), "utf8"))
        .join("\n");
      if (!/letter-spacing:\s*\.16em|letter-spacing:\s*0\.16em/.test(css))
        throw new Error(
          "built CSS lacks component classes: @web4kit/react/tailwind.css not applied",
        );
      const port = 3099 - i;
      const server = spawn("pnpm", ["exec", "next", "start", "--port", String(port)], {
        cwd: site,
        stdio: "ignore",
        env: { ...process.env, JEV_API_KEY: "" },
      });
      try {
        let html = "";
        for (let t = 0; t < 60 && !html; t++) {
          await new Promise((r) => setTimeout(r, 1000));
          html = await fetch(`http://localhost:${port}/${starter.query}`).then(
            (r) => (r.ok ? r.text() : ""),
            () => "",
          );
        }
        const blocks = [...html.matchAll(/data-w4-block="([a-z-]+)"/g)].map((m) => m[1]);
        const missing = starter.want.filter((b) => !blocks.includes(b));
        if (missing.length)
          throw new Error(
            `${starter.template} page missing blocks ${missing}: ${blocks.join(", ")}`,
          );
        if (starter.never.some((b) => blocks.includes(b)))
          throw new Error(`${starter.template}: production must ignore ?as= persona previews`);
        if (html.includes("Preview as"))
          throw new Error(`${starter.template}: production must not render the dev persona bar`);
        console.log(
          `\n✓ ${starter.template} starter smoke passed: scaffolded, built and served (${blocks.join(", ")})`,
        );
      } finally {
        server.kill();
      }
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

/** Wait until every `name@version` is visible on the registry (it can lag a publish by minutes). */
async function waitForRegistry(specs, timeoutMs = 5 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  let missing = specs;
  while (missing.length) {
    missing = missing.filter((spec) => {
      try {
        execSync(`npm view ${spec} version`, { stdio: "pipe" });
        return false;
      } catch {
        return true;
      }
    });
    if (!missing.length) break;
    if (Date.now() > deadline)
      throw new Error(`not on the registry after ${timeoutMs / 60_000} min: ${missing.join(", ")}`);
    console.log(`waiting for the registry: ${missing.join(", ")}`);
    await new Promise((r) => setTimeout(r, 15_000));
  }
  console.log(`✓ on the registry: ${specs.length} packages`);
}
