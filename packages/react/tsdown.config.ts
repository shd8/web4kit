import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/why.ts", "src/xray.tsx", "src/xray-client.tsx"],
  format: "esm",
  dts: true,
  clean: true,
  platform: "neutral",
  unbundle: false,
  copy: ["src/tokens.css", "src/tailwind.css"],
});
