import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@web4/context",
    "@web4/decider",
    "@web4/ir",
    "@web4/manifest",
    "@web4/planner",
    "@web4/react",
    "@web4/solver",
    "@web4/example-restaurant",
    "@web4/example-db-explorer",
  ],
  images: { remotePatterns: [{ hostname: "images.unsplash.com" }] },
  agentRules: false,
};

export default config;
