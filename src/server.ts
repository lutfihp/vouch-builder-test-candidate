import Fastify from "fastify";
import { z } from "zod";
import { logger } from "./log/logger.js";
import { buildFacts } from "./facts/build.js";
import { reconcile } from "./reconcile/issues.js";
import { applyUrgency } from "./reconcile/urgency.js";
import { buildHandover } from "./render/handover.js";
import type { Event } from "./types.js";

const eventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  room: z.string().nullable(),
  guest: z.string().nullable(),
  description: z.string(),
  status: z.enum(["resolved", "unresolved", "pending"]),
});

const bodySchema = z.object({
  hotelId: z.string(),
  hotelOffset: z.string().default("+00:00"),
  asOfShift: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  events: z.array(eventSchema),
  nightLogs: z.string().optional(),
});

export const generateHandover = async (input: z.infer<typeof bodySchema>) => {
  const { facts, topLevelFlags } = await buildFacts(
    input.hotelId, input.hotelOffset, input.events as Event[],
    input.nightLogs, 2026
  );
  const issues = applyUrgency(reconcile(input.hotelId, facts), input.asOfShift);
  return buildHandover(input.hotelId, input.asOfShift, issues, topLevelFlags);
};

export const buildServer = () => {
  const app = Fastify({ logger });

  app.get("/healthz", async () => ({ ok: true }));

  app.post("/handover", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    }
    return await generateHandover(parsed.data);
  });

  app.get("/handover.html", async (req, reply) => {
    const { readFile } = await import("node:fs/promises");
    const asOfShift = (req.query as any)?.asOfShift ?? "2026-05-30";
    const raw = JSON.parse(await readFile("data/events.json", "utf8")) as any;
    const nightLogs = await readFile("data/night-logs.md", "utf8").catch(() => undefined);
    const h = await generateHandover({
      hotelId: raw.hotel.id,
      hotelOffset: raw.hotel.timezone,
      asOfShift,
      events: raw.events,
      nightLogs,
    });
    const { renderHandoverHtml } = await import("./render/html.js");
    reply.type("text/html").send(renderHandoverHtml(h));
  });

  return app;
};

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  buildServer().listen({ port, host: "0.0.0.0" }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
