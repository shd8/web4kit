import { Laya, type LayaOptions } from "@receptron/laya";
import {
  type Capabilities,
  createEngineDecider,
  type Decider,
  LAYA_CLASS_CAPABILITIES,
  toWireQuestion,
  type WireAnswer,
} from "@web4kit/decider";

/** Pinned Laya ONNX bundle (receptron/laya-onnx on Hugging Face), for reproducible answers. */
export const LAYA_ONNX_REVISION = "68f27dfe5a27a54fb2b1fefc432f43f972e90868";

export const LAYA_IN_PROCESS_CAPABILITIES: Capabilities = {
  ...LAYA_CLASS_CAPABILITIES,
  // One forward pass per call; a full page is a few batched calls.
  maxQuestionsPerRequest: 24,
  deterministic: true, // fp32 ONNX on CPU: identical inputs give identical outputs
};

export interface InProcessLayaOptions extends Omit<LayaOptions, "revision"> {
  revision?: string;
}

/**
 * InProcessDecider (design D2): runs Laya inside the Node process via ONNX Runtime.
 * No server and no network once the weights are cached (~1.7 GB under ~/.cache/receptron-laya).
 */
export async function createInProcessLayaDecider(
  options: InProcessLayaOptions = {},
): Promise<Decider & { close(): Promise<void> }> {
  const revision = options.revision ?? LAYA_ONNX_REVISION;
  const laya = await Laya.load({ ...options, revision });
  const id = `laya-onnx@${revision.slice(0, 12)}`;
  const decider = createEngineDecider({
    id,
    capabilities: LAYA_IN_PROCESS_CAPABILITIES,
    async call(state, questions) {
      const wire = Object.fromEntries(
        Object.entries(questions).map(([qid, q]) => [qid, toWireQuestion(q)]),
      );
      const result = await laya.systemOne(
        state,
        wire as unknown as Parameters<typeof laya.systemOne>[1],
      );
      return {
        answers: result.answers as Record<string, WireAnswer>,
        engineVersion: id,
        inputTokens: result.usage?.input_tokens ?? 0,
      };
    },
  });
  return { ...decider, close: () => laya.close() };
}
