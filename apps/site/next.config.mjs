import { resolve } from "node:path";
import { createMDX } from "fumadocs-mdx/next";

/** Static export (design D9): any static host, at a domain root or under SITE_BASE_PATH. */
const basePath = process.env.SITE_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // The repository docs live outside the app (../../docs): let the bundler see the monorepo.
  turbopack: { root: resolve(import.meta.dirname, "../..") },
  transpilePackages: [
    "@web4kit/context",
    "@web4kit/decider",
    "@web4kit/ir",
    "@web4kit/manifest",
    "@web4kit/react",
    "@web4kit/solver",
  ],
  agentRules: false,
};

export default createMDX()(config);
