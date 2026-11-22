import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import type { Config } from "./config.js";
import type { Db } from "./db/tenant.js";
import { publicRoutes } from "./routes/public.js";

export type HealthCheck = () => Promise<boolean>;

export function buildApp(config: Config, dbCheck: HealthCheck = async () => true, db?: Db) {
  const app = Fastify({ logger: config.NODE_ENV !== "test" });

  app.register(cors, { origin: config.FRONTEND_ORIGIN, credentials: true });
  app.register(cookie);

  app.get("/api/health", async (_req, reply) => {
    let db = false;
    try {
      db = await dbCheck();
    } catch {
      db = false;
    }
    return reply.code(db ? 200 : 503).send({ status: db ? "ok" : "degraded", db });
  });

  if (db) publicRoutes(app, db);

  return app;
}
