import { createJevDecider, type Decider, jevConfigFromEnv } from "@web4kit/decider";

/**
 * The System One engine that plans pages, chosen with W4_ENGINE:
 *   jev    TypeSafe Jev (hosted; needs JEV_API_KEY). The default when a key is set.
 *   laya   Laya running in this process on ONNX Runtime: free and offline, for development.
 *          Needs `pnpm add @web4kit/decider-laya`; the first run downloads ~1.7 GB of weights.
 *   rules  The offline rules engine (your manifest heuristics). The default without a key.
 */
export async function engineFromEnv(env = process.env): Promise<Decider | undefined> {
  const jev = jevConfigFromEnv(env);
  const choice = env.W4_ENGINE ?? (jev ? "jev" : "rules");
  if (choice === "rules") return undefined;
  if (choice === "jev") {
    if (!jev) throw new Error("W4_ENGINE=jev needs JEV_API_KEY in .env");
    return createJevDecider(jev);
  }
  if (choice === "laya") {
    // A variable specifier keeps Laya optional: nothing is bundled unless it is installed.
    const specifier = "@web4kit/decider-laya";
    try {
      const { createInProcessLayaDecider } = await import(/* webpackIgnore: true */ specifier);
      return (await createInProcessLayaDecider()) as Decider;
    } catch (e) {
      throw new Error(
        `W4_ENGINE=laya needs @web4kit/decider-laya: run \`pnpm add @web4kit/decider-laya\` (${e instanceof Error ? e.message : e})`,
      );
    }
  }
  throw new Error(`unknown W4_ENGINE "${choice}" (use jev, laya or rules)`);
}
