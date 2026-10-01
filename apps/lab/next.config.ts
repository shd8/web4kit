import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: [
    "@web4kit/context",
    "@web4kit/decider",
    "@web4kit/demo-controls",
    "@web4kit/ir",
    "@web4kit/manifest",
    "@web4kit/planner",
    "@web4kit/react",
    "@web4kit/solver",
    "@web4kit/example-restaurant",
    "@web4kit/example-db-explorer",
  ],
  images: { remotePatterns: [{ hostname: "images.unsplash.com" }] },
  agentRules: false,
};

export default config;
