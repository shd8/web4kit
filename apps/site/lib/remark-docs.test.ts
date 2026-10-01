import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { remark } from "remark";
import { describe, expect, it } from "vitest";
import { remarkDocs, rewriteDocsUrl } from "./remark-docs";

const DOCS = resolve(import.meta.dirname, "../../../docs");
const process = (md: string) => remark().use(remarkDocs).processSync(md).toString();

describe("remark plugin for the repository docs (launch-site 3.3)", () => {
  it("rewrites relative links outside docs to GitHub and keeps doc links", () => {
    expect(rewriteDocsUrl("components.md")).toBe("/docs/components/");
    expect(rewriteDocsUrl("seo.md#what-crawlers-get")).toBe("/docs/seo/#what-crawlers-get");
    expect(rewriteDocsUrl("../schemas")).toBe("https://github.com/shd8/web4/tree/main/schemas");
    expect(rewriteDocsUrl("../examples/restaurant")).toBe(
      "https://github.com/shd8/web4/tree/main/examples/restaurant",
    );
    expect(rewriteDocsUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(rewriteDocsUrl("#8-the-development-loop")).toBe("#8-the-development-loop");
  });

  it("drops the leading H1 (the title) and nothing else", () => {
    const out = process("# Title\n\nIntro\n\n## Section\n\n# Not first\n");
    expect(out).not.toContain("# Title");
    expect(out).toContain("## Section");
    expect(out).toContain("# Not first");
  });

  it("handles every real docs file: no title left, no relative link outside docs", () => {
    for (const file of readdirSync(DOCS).filter((f) => f.endsWith(".md"))) {
      const source = readFileSync(resolve(DOCS, file), "utf8");
      const out = process(source);
      const title = /^#\s+(.+)$/m.exec(source)![1]!;
      expect(out.startsWith(`# ${title}`), file).toBe(false);
      for (const [, url] of out.matchAll(/\]\(([^)\s]+)\)/g)) {
        expect(url, `${file}: ${url}`).toMatch(/^(https?:|#|\/docs\/[a-z0-9-]+\/)/);
      }
    }
  });
});
