// Browser checks against the static export (out/), served by a plain static server.
//   node e2e/run.mjs [check ...]      needs Chrome installed (Playwright drives it); HEADED=1 to watch
import { chromium } from "playwright-core";
import { serve } from "../scripts/serve.mjs";

const PORT = 3042;
const base = process.env.SITE_BASE_PATH ?? "";
const origin = `http://localhost:${PORT}`;
const url = (path) => `${origin}${base}${path}`;
export const checks = {};

/**
 * Requests that leave the site. The demo content's photos load from their CDN (they are data,
 * like on a real site); anything else (an engine, an API, a backend) is a failure.
 */
function watch(page) {
  const foreign = [];
  const errors = [];
  page.on("request", (r) => {
    if (r.url().startsWith(origin) || r.url().startsWith("data:")) return;
    if (r.resourceType() === "image") return;
    foreign.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { foreign, errors };
}

checks.search = async (browser) => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(url("/docs/getting-started/"), { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: /Search/ })
    .first()
    .click();
  await page.getByPlaceholder("Search").fill("calibration");
  const results = page.locator("[role=dialog] button").filter({ hasText: /calibrat/i });
  await results.first().waitFor({ timeout: 10_000 });
  const hits = await results.allInnerTexts();
  return { ok: hits.length > 0 && seen.foreign.length === 0, hits: hits.slice(0, 5), ...seen };
};

checks.tryIt = async (browser) => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(url("/"), { waitUntil: "networkidle" });
  const block = page.locator("[data-try-it]");
  const text = await block.innerText();
  const button = await block.getByRole("button", { name: /copy/i }).count();
  return {
    ok: text.includes("pnpm create web4kit") && button === 1 && !seen.errors.length,
    ...seen,
  };
};

/** Wait until the playground shows a plan for the current controls. */
async function ready(page) {
  await page.locator("[data-w4-plan]").first().waitFor({ timeout: 30_000 });
}
const blocks = (page) =>
  page
    .locator("[data-w4-block]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-w4-block")));
async function setRange(page, control, value) {
  const site = await page.locator("[data-playground]").getAttribute("data-playground");
  const index = await (await fetch(url(`/playground/${site}/index.json`))).json();
  const i = index.controls
    .find((c) => c.id === control)
    .options.findIndex((o) => o.value === value);
  if (i < 0) throw new Error(`no value ${value} for ${control}`);
  await page.locator(`[data-control="${control}"]`).fill(String(i));
  await page.waitForFunction(
    ([c, v]) => document.querySelector(`[data-control-value="${c}"]`)?.textContent === v,
    [control, value],
  );
}

checks.closingTime = async (browser) => {
  const page = await browser.newPage();
  const seen = watch(page);
  const q =
    "site=restaurant&day=2026-09-29&time=13:00&arrival=direct&device=desktop&distance=nearby&language=en-GB&visits=none";
  await page.goto(url(`/playground/?${q}`), { waitUntil: "networkidle" });
  await ready(page);
  const lunch = await blocks(page);
  const lunchHours = await page
    .locator('[data-w4-block="hours"]')
    .innerText()
    .catch(() => "");
  await setRange(page, "time", "23:40");
  await page.waitForFunction(() => !document.querySelector('[data-w4-block="lunch-menu"]'), null, {
    timeout: 10_000,
  });
  const late = await blocks(page);
  const lateHours = await page.locator('[data-w4-block="hours"]').innerText();
  const ok =
    lunch.includes("lunch-menu") &&
    !late.includes("lunch-menu") &&
    // The status line (the day list always shows Monday closed).
    /^\s*\S.*\n+\s*Closed ·/im.test(lateHours) &&
    /Open now/.test(lunchHours) &&
    seen.foreign.length === 0;
  return {
    ok,
    lunch,
    late,
    lunchHours: lunchHours.slice(0, 120),
    lateHours: lateHours.slice(0, 80),
    ...seen,
  };
};

checks.persona = async (browser) => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(url("/playground/?site=hotel"), { waitUntil: "networkidle" });
  await ready(page);
  await page.locator('[data-persona="arriving-today"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-persona="arriving-today"]')?.getAttribute("aria-pressed") ===
      "true",
  );
  const pressed = await page
    .locator('[data-control] [aria-pressed="true"]')
    .evaluateAll((els) =>
      els.map((e) => `${e.closest("[data-control]").dataset.control}=${e.dataset.value}`),
    );
  const time = await page.locator('[data-control-value="time"]').innerText();
  const ok =
    pressed.includes("stay=arriving-today") &&
    pressed.includes("distance=nearby") &&
    time === "13:00" &&
    (await blocks(page)).includes("arrival-guide") &&
    seen.foreign.length === 0;
  return { ok, pressed, time, blocks: await blocks(page), ...seen };
};

checks.siteSwitch = async (browser) => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(url("/playground/?site=restaurant"), { waitUntil: "networkidle" });
  await ready(page);
  await page.getByRole("button", { name: "Welcome starter" }).click();
  await page.waitForFunction(
    () => document.querySelector("[data-playground]")?.dataset.playground === "welcome",
  );
  await ready(page);
  const controls = await page
    .locator("[data-control]")
    .evaluateAll((els) => [...new Set(els.map((e) => e.dataset.control))]);
  const ok =
    JSON.stringify(controls.sort()) === JSON.stringify(["arrival", "device", "time"]) &&
    seen.foreign.length === 0;
  return { ok, controls, ...seen };
};

/** Count view transitions the page starts while the layout changes. */
async function transitionsOnChange(browser, reducedMotion) {
  const context = await browser.newContext({ reducedMotion });
  await context.addInitScript(() => {
    window.__transitions = 0;
    const original = document.startViewTransition?.bind(document);
    if (original)
      document.startViewTransition = (cb) => {
        window.__transitions++;
        return original(cb);
      };
  });
  const page = await context.newPage();
  await page.goto(url("/playground/?site=hotel"), { waitUntil: "networkidle" });
  await ready(page);
  const before = await blocks(page);
  await page.locator('[data-control="stay"] [data-value="in-house"]').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-control="stay"] [data-value="in-house"]')
        ?.getAttribute("aria-pressed") === "true",
  );
  const after = await blocks(page);
  const count = await page.evaluate(() => window.__transitions);
  await context.close();
  return { count, changed: JSON.stringify(before) !== JSON.stringify(after) };
}

checks.viewTransition = async (browser) => {
  const animated = await transitionsOnChange(browser, "no-preference");
  const reduced = await transitionsOnChange(browser, "reduce");
  return {
    ok: animated.changed && animated.count === 1 && reduced.changed && reduced.count === 0,
    animated,
    reduced,
  };
};

checks.xrayAndCounters = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const seen = watch(page);
  await page.goto(url("/playground/?site=restaurant"), { waitUntil: "networkidle" });
  await ready(page);
  await page.getByRole("button", { name: /X-ray off/ }).click();
  const hero = page.locator('[data-w4-region="hero"] [data-w4-block]').first();
  const id = await hero.getAttribute("data-w4-block");
  await hero.hover({ position: { x: 20, y: 20 } });
  const card = page.locator(`[data-w4-xray-card="${id}"]`);
  await card.waitFor({ timeout: 5000 });
  const rows = await card
    .locator("[data-w4-why]")
    .evaluateAll((r) => r.map((x) => x.dataset.w4Why));
  const cardText = await card.innerText();
  const meta = await (await fetch(url("/playground/restaurant/meta.json"))).json();
  const planHash = await page.locator("[data-w4-plan]").first().getAttribute("data-w4-plan");
  const usage = meta.plans[planHash];
  const thisPage = await page.locator('[data-counter="This page"]').innerText();
  const timing = await page.locator('[data-counter="Planning time"]').innerText();
  const tryIt = await page.locator("[data-try-it]").count();
  const kinds = ["A.relevance", "A.salience", "C.region", "C.prominence"];
  const ok =
    kinds.every((k) => rows.includes(k)) &&
    cardText.includes(meta.engine) &&
    thisPage ===
      `${usage.inputTokens.toLocaleString("en")} tokens · $${usage.costUsd.toFixed(5)}` &&
    timing === `${usage.planningMs} ms` &&
    tryIt === 1 &&
    seen.foreign.length === 0;
  return { ok, hero: id, rows, engine: meta.engine, thisPage, timing, ...seen };
};

checks.audienceEmbed = async (browser) => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(url("/sources-and-audience/"), { waitUntil: "networkidle" });
  const embed = page.locator('[data-embed="hotel"]');
  await embed.locator("[data-embed-plan]").waitFor({ timeout: 30_000 });
  const embedBlocks = () =>
    embed
      .locator("[data-w4-block]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-w4-block")));
  // Expected blocks: straight from the precomputed plan for each combination.
  const index = await (await fetch(url("/playground/hotel/index.json"))).json();
  const base = index.personas.find((p) => p.name === "in-house-morning").values;
  const expected = async (stay) => {
    const values = { ...base, stay };
    let pos = 0;
    for (const c of index.controls)
      pos = pos * c.options.length + c.options.findIndex((o) => o.value === values[c.id]);
    const plan = await (
      await fetch(url(`/playground/hotel/plans/${index.plans[index.entries[pos][0]]}.json`))
    ).json();
    return ["hero", "primary", "aside", "secondary", "footer"].flatMap((r) =>
      plan.layout[r].map((b) => b.sourceId),
    );
  };
  const researching = await embedBlocks();
  const before = await embed.locator("[data-embed-plan]").getAttribute("data-embed-plan");
  await embed.locator('[data-embed-option="in-house"]').click();
  await page.waitForFunction(
    (hash) => {
      const plan = document.querySelector('[data-embed="hotel"] [data-embed-plan]');
      return plan && plan.getAttribute("data-embed-plan") !== hash;
    },
    before,
    { timeout: 10_000 },
  );
  const inHouse = await embedBlocks();
  const [wantResearching, wantInHouse] = [
    await expected("researching"),
    await expected("in-house"),
  ];
  const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const ok =
    researching.includes("rooms") &&
    !inHouse.includes("rooms") &&
    same(researching, wantResearching) &&
    same(inHouse, wantInHouse) &&
    seen.foreign.length === 0;
  return { ok, researching, inHouse, ...seen };
};

checks.conceptsEmbeds = async (browser) => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(url("/concepts/"), { waitUntil: "networkidle" });
  await page
    .locator('[data-embed="restaurant"] [data-embed-plan]')
    .first()
    .waitFor({ timeout: 30_000 });
  const labels = page.getByRole("list", { name: "Situation labels" }).first();
  const evening = await labels.innerText();
  await page
    .locator('[data-embed="restaurant"]')
    .first()
    .locator('[data-embed-option="23:40"]')
    .click();
  await page.waitForFunction(() =>
    /openState: ?\s*closed/.test(
      document.querySelector('[aria-label="Situation labels"]')?.textContent ?? "",
    ),
  );
  const late = await labels.innerText();
  const why = await page.locator("[data-embed-why] tbody tr").count();
  const ok =
    /openState:\s*open/.test(evening) &&
    /openState:\s*closed/.test(late) &&
    why >= 4 &&
    !seen.errors.length;
  return { ok, evening: evening.replace(/\n/g, " "), late: late.replace(/\n/g, " "), why, ...seen };
};

import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

checks.routes = async (browser) => {
  const out = resolve(import.meta.dirname, "../out");
  const routes = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) {
        if (f !== "_next") walk(p);
      } else if (f === "index.html")
        routes.push(`/${relative(out, d)}${relative(out, d) ? "/" : ""}`);
    }
  };
  walk(out);
  const page = await browser.newPage();
  const seen = watch(page);
  const failed = [];
  for (const route of routes) {
    const res = await page.goto(url(route), { waitUntil: "networkidle" });
    const h1 = await page
      .locator("h1")
      .first()
      .innerText()
      .catch(() => "");
    if (!res?.ok() || !h1) failed.push(`${route} (${res?.status()})`);
  }
  return {
    ok: failed.length === 0 && seen.foreign.length === 0 && !seen.errors.length,
    routes,
    failed,
    ...seen,
  };
};

/** A deterministic sample of combinations per site, each checked against its precomputed plan. */
checks.combinations = async (browser) => {
  const page = await browser.newPage();
  const seen = watch(page);
  const failed = [];
  let checked = 0;
  for (const site of ["restaurant", "hotel", "welcome"]) {
    const index = await (await fetch(url(`/playground/${site}/index.json`))).json();
    const total = index.entries.length;
    for (let k = 0; k < Math.min(50, total); k++) {
      const pos = Math.floor((k * 7919 * total) / 50 + k) % total; // spread, deterministic
      let rest = pos;
      const values = {};
      for (let i = index.controls.length - 1; i >= 0; i--) {
        const c = index.controls[i];
        values[c.id] = c.options[rest % c.options.length].value;
        rest = Math.floor(rest / c.options.length);
      }
      const want = index.plans[index.entries[pos][0]];
      await page.goto(url(`/playground/?${new URLSearchParams({ site, ...values })}`));
      await page
        .waitForSelector(`[data-w4-plan="${want}"]`, { timeout: 15_000 })
        .catch(() => failed.push(`${site} #${pos}`));
      checked++;
    }
  }
  return {
    ok: failed.length === 0 && seen.foreign.length === 0 && !seen.errors.length,
    checked,
    failed,
    foreign: seen.foreign,
    errors: seen.errors,
  };
};

const wanted = process.argv.slice(2);
const server = await serve(PORT);
const browser = await chromium.launch({ channel: "chrome", headless: !process.env.HEADED });
let failed = 0;
try {
  for (const [name, check] of Object.entries(checks)) {
    if (wanted.length && !wanted.includes(name)) continue;
    const result = await check(browser);
    if (!result.ok) failed++;
    console.log(`${result.ok ? "✓" : "✖"} ${name}`, JSON.stringify(result));
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
