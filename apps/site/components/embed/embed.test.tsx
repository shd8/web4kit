import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type SiteIndex, viewRefs } from "@/lib/playground/bundle";
import { EmbedView } from "./embed-view";

const DIR = resolve(import.meta.dirname, "../../public/playground/hotel");
const read = (p: string) => JSON.parse(readFileSync(resolve(DIR, p), "utf8"));

/** The view of a combination, straight from the bundle files. */
function viewFor(values: Record<string, string>) {
  const index = read("index.json") as SiteIndex;
  const { planHash, dataSet } = viewRefs(index, values);
  const plan = read(`plans/${planHash}.json`);
  const data = Object.fromEntries(
    Object.entries(dataSet).map(([id, h]) => [id, read(`data/${h}.json`)]),
  );
  return { plan, data, planHash, index };
}

describe("situation embed (launch-site 5.1)", () => {
  const index = read("index.json") as SiteIndex;
  const base = index.personas.find((p) => p.name === "in-house-morning")!.values;
  const manifests = read("manifests.json");

  it("renders the plan for the selected value and highlights the focused block", () => {
    const researching = viewFor({ ...base, stay: "researching" });
    const html = renderToStaticMarkup(
      <EmbedView
        scope="a"
        plan={researching.plan}
        data={researching.data}
        manifests={manifests}
        theme="azulejo"
        focus="rooms"
        situation={read("situations.json")[researching.planHash]}
        showWhy
      />,
    );
    expect(html).toContain(`data-embed-plan="${researching.planHash}"`);
    expect(html).toContain('data-w4-block="rooms" data-w4-component');
    expect(html).toContain(`[data-embed-scope="a"] [data-w4-block="rooms"]{outline`);
    expect(html).toContain('data-embed-focus-state="shown"');
    expect(html).toContain("stayPhase: <b>researching</b>");
    expect(html).toContain("data-embed-why");
  });

  it("shows the focused block as absent when the plan leaves it out", () => {
    const inHouse = viewFor({ ...base, stay: "in-house" });
    const html = renderToStaticMarkup(
      <EmbedView
        scope="b"
        plan={inHouse.plan}
        data={inHouse.data}
        manifests={manifests}
        theme="azulejo"
        focus="rooms"
      />,
    );
    expect(html).not.toContain('data-w4-block="rooms" data-w4-component');
    expect(html).toContain('data-embed-focus-state="absent"');
  });
});
