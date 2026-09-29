import { existsSync } from "node:fs";

/**
 * Load a .env file into process.env if it exists. Existing variables are not overwritten.
 * Uses Node's built-in loader, so no dependency is needed.
 */
export function loadDotEnv(path = ".env"): boolean {
  if (!existsSync(path)) return false;
  process.loadEnvFile(path);
  return true;
}
