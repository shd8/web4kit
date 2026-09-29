import { type ContextEnvelope, collectEnvelope } from "@web4/context";
import { type Plan, validatePlan } from "@web4/ir";
import { z } from "zod";
import { isExampleId } from "@/lib/examples";
import { dataFor, LAB_MODE } from "@/lib/server";

const Body = z.object({
  example: z.string(),
  plan: z.custom<Plan>((v) => !!v && typeof v === "object"),
  envelope: z.custom<ContextEnvelope>((v) => !!v && typeof v === "object"),
});

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !isExampleId(body.data.example))
    return Response.json({ error: "bad request" }, { status: 400 });
  const plan = validatePlan(body.data.plan);
  const envelope = LAB_MODE
    ? body.data.envelope
    : collectEnvelope({ url: request.url, headers: request.headers }).envelope;
  return Response.json(await dataFor(body.data.example, plan, envelope));
}
