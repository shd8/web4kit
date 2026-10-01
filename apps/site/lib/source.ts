import { loader } from "fumadocs-core/source";
import { pageSchema } from "fumadocs-core/source/schema";
import { applyMdxPreset } from "fumadocs-mdx/config";
import { defineDocs } from "fumadocs-mdx/macro";
import { z } from "zod";
import { remarkDocs } from "./remark-docs";

/** Title of a Markdown file from its first `# ` heading (the repository docs have no frontmatter). */
const firstHeading = (source: string) => /^#\s+(.+)$/m.exec(source)?.[1]?.trim() ?? "Untitled";

const titledFromHeading = ({ source }: { source: string }) =>
  pageSchema.extend({ title: z.string().default(firstHeading(source)) });

/**
 * The repository's docs/*.md are the canonical reference (design D6): rendered as they are, so
 * GitHub links keep working. Internal notes are left out by name.
 */
const docs = defineDocs({
  dir: "../../docs",
  docs: {
    files: ["*.md", "!v1-frictions.md"],
    schema: titledFromHeading,
    mdxOptions: applyMdxPreset({ remarkPlugins: (defaults) => [remarkDocs, ...defaults] }),
  },
});

/** Site-only pages with live embeds (concepts, sources and audience, the thesis when written). */
const pages = defineDocs({ dir: "content" });

export const source = loader({ baseUrl: "/docs", source: docs.toFumadocsSource() });
export const sitePages = loader({ baseUrl: "/", source: pages.toFumadocsSource() });
