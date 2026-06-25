import Fastify from "fastify";
import { logger } from "./log/logger.js";

export const buildServer = () => {
  const app = Fastify({ logger });

  app.get("/healthz", async () => ({ ok: true }));

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
