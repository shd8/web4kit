import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next keeps JSX for its own compiler (tsconfig "preserve"); tests compile it here.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": resolve(import.meta.dirname) } },
  test: { include: ["**/*.test.{ts,tsx}"], exclude: ["node_modules", "out", ".next"] },
});
