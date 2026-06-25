import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { fileURLToPath } from "node:url";
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

// JSON Schema describes the API for swagger only; real validation happens via Zod inside the handler.
const handoverRequestSchema = {
  type: "object",
  required: ["hotelId", "asOfShift", "events"],
  properties: {
    hotelId: { type: "string", example: "lumen-sg" },
    hotelOffset: { type: "string", example: "+08:00", description: "Hotel TZ offset, e.g. +08:00" },
    asOfShift: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", example: "2026-05-30", description: "Morning-of date of the shift to generate the handover for" },
    events: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "timestamp", "type", "room", "guest", "description", "status"],
        properties: {
          id: { type: "string", example: "evt_0007" },
          timestamp: { type: "string", example: "2026-05-27T00:15:00+08:00" },
          type: { type: "string", example: "deposit_issue" },
          room: { type: ["string", "null"], example: "309" },
          guest: { type: ["string", "null"], example: "Jaydeep Suthkumar" },
          description: { type: "string", example: "Card declined for SGD 100 deposit." },
          status: { type: "string", enum: ["resolved", "unresolved", "pending"] },
        },
      },
    },
    nightLogs: { type: "string", description: "Free-text night-log markdown. Optional. Must contain a '## Night of ... → morning ...' heading.", example: "## Night of Wed 27 May → morning Thu 28 May\n\n- 309 — still no deposit on file." },
  },
};

export const buildServer = async () => {
  const app = Fastify({
    logger,
    ajv: { customOptions: { keywords: ["example"] } },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Vouch Night-Shift Handover",
        description: "Generates an action-first morning handover from a hotel's overnight events + optional free-text night log. Reconciliation is deterministic; an LLM extracts facts from prose only, behind a verbatim-excerpt schema gate.",
        version: "0.1.0",
      },
      servers: [
        { url: "https://night-shift.codading.site", description: "Production" },
        { url: "http://localhost:3000", description: "Local dev" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: false },
  });

  app.get("/healthz", {
    schema: {
      summary: "Healthcheck",
      response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } },
    },
  }, async () => ({ ok: true }));

  app.post("/handover", {
    schema: {
      summary: "Generate a morning handover",
      description: "Ingests structured events + optional prose night log, reconciles issues across shifts, returns an action-first handover with evidence-linked items.",
      body: handoverRequestSchema,
    },
  }, async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
    }
    return await generateHandover(parsed.data);
  });

  app.get("/handover.html", {
    schema: {
      summary: "HTML view of the bundled sample handover",
      querystring: {
        type: "object",
        properties: { asOfShift: { type: "string", example: "2026-05-30" } },
      },
    },
  }, async (req, reply) => {
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

const isMain = (() => {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();

if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  buildServer().then((app) => app.listen({ port, host: "0.0.0.0" })).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
