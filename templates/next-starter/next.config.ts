import type { NextConfig } from "next";

const config: NextConfig = {
  // Only needed while developing inside the web4 monorepo (packages resolve to TypeScript source).
  transpilePackages: [
    "@web4kit/context",
    "@web4kit/decider",
    "@web4kit/ir",
    "@web4kit/manifest",
    "@web4kit/planner",
    "@web4kit/react",
    "@web4kit/solver",
  ],
  agentRules: false,
};

export default config;
