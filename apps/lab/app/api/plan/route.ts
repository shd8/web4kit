import { type ContextEnvelope, collectEnvelope } from "@web4/context";
import { z } from "zod";
import { isExampleId } from "@/lib/examples";
import { LAB_MODE, planFor } from "@/lib/server";

const Body = z.object({
  example: z.string(),
  engine: z.enum(["rules", "local", "jev", "cascade"]).default("rules"),
  envelope: z.custom<ContextEnvelope>((v) => !!v && typeof v === "object"),
  intent: z.object({ text: z.string().max(280), language: z.string() }).optional(),
});

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !isExampleId(body.data.example))
    return Response.json({ error: "bad request" }, { status: 400 });
  // Outside lab mode, client-supplied envelopes and engine choices are ignored (spec: context-envelope).
  const envelope = LAB_MODE
    ? body.data.envelope
    : collectEnvelope({ url: request.url, headers: request.headers }).envelope;
  const engine = LAB_MODE ? body.data.engine : "rules";
  const result = await planFor(body.data.example, envelope, engine, body.data.intent);
  return Response.json(result);
}
