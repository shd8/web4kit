import type { NextConfig } from "next";

const config: NextConfig = {
  // Only needed while developing inside the web4 monorepo (packages resolve to TypeScript source).
  transpilePackages: [
    "@web4kit/context",
    "@web4kit/decider",
    "@web4kit/ir",
    "@web4kit/manifest",
    "@web4kit/next",
    "@web4kit/planner",
    "@web4kit/react",
    "@web4kit/solver",
  ],
  // Optional in-process Laya (W4_ENGINE=laya) loads native ONNX Runtime: never bundle it.
  serverExternalPackages: ["@web4kit/decider-laya", "@receptron/laya", "onnxruntime-node"],
  agentRules: false,
};

export default config;
