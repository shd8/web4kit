import { GITHUB_TREE } from "./links";

/**
 * Remark plugin for the repository docs (design D6), which are written for GitHub:
 * - the first `# ` heading is the page title (rendered by the layout), so it leaves the body;
 * - links to other docs files (`components.md`) become their site pages (`/docs/components/`);
 * - other relative links (`../schemas`, `../examples/restaurant`) point at the repository on
 *   GitHub, where they resolve.
 */
type Node = { type: string; depth?: number; url?: string; children?: Node[] };

const DOCS_BASE = `${GITHUB_TREE}/docs/`;

export function rewriteDocsUrl(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("/") || url.startsWith("#")) return url;
  const [path = "", hash] = url.split("#");
  // A sibling doc is a site page (Next's Link adds the base path).
  if (path.endsWith(".md") && !path.includes("/"))
    return `/docs/${path.slice(0, -3)}/${hash ? `#${hash}` : ""}`;
  return new URL(url, DOCS_BASE).href;
}

export function remarkDocs() {
  return (tree: Node) => {
    const first = tree.children?.findIndex((n) => n.type !== "yaml" && n.type !== "toml");
    if (first !== undefined && first >= 0) {
      const node = tree.children![first]!;
      if (node.type === "heading" && node.depth === 1) tree.children!.splice(first, 1);
    }
    const walk = (node: Node) => {
      if ((node.type === "link" || node.type === "definition") && node.url)
        node.url = rewriteDocsUrl(node.url);
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}
