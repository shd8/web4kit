// Writes the language-neutral JSON Schemas (the canonical contracts, design D1) to /schemas.
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { CapabilitiesSchema, QuestionSchema, StateSchema } from "../packages/decider/src/index";
import { planJsonSchema } from "../packages/ir/src/index";

const out = (name: string, schema: unknown) =>
  writeFileSync(`schemas/${name}.schema.json`, `${JSON.stringify(schema, null, 2)}\n`);

out("web4.plan.v1", planJsonSchema());
out("decider.question", z.toJSONSchema(QuestionSchema));
out("decider.state", z.toJSONSchema(StateSchema));
out("decider.capabilities", z.toJSONSchema(CapabilitiesSchema));
console.log("schemas written");
