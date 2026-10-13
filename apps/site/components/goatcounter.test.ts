import { describe, expect, it } from "vitest";
import { defaultValues, valuesFromQuery } from "@/lib/playground/bundle";
import { pagePath } from "./goatcounter";

describe("GoatCounter page paths", () => {
  it("drops the base path and keeps the trailing slash", () => {
    expect(pagePath("/web4kit/playground/", "/web4kit")).toBe("/playground/");
    expect(pagePath("/web4kit/", "/web4kit")).toBe("/");
    expect(pagePath("/web4kit", "/web4kit")).toBe("/");
    expect(pagePath("/docs/getting-started/", "")).toBe("/docs/getting-started/");
  });
});

describe("playground query", () => {
  it("ignores unknown params such as ?ref= (GoatCounter's source)", () => {
    const index = {
      personas: [],
      controls: [{ id: "device", options: [{ value: "mobile" }, { value: "desktop" }] }],
    } as unknown as Parameters<typeof valuesFromQuery>[0];
    const query = new URLSearchParams("ref=linkedin-demo&device=desktop");
    expect(valuesFromQuery(index, query)).toEqual({ device: "desktop" });
    expect(valuesFromQuery(index, new URLSearchParams("ref=linkedin-demo"))).toEqual(
      defaultValues(index),
    );
  });
});
