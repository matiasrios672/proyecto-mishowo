import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { Config } from "./config.js";
import type { Db } from "./db/tenant.js";
import { publicRoutes } from "./routes/public.js";
import { planRoutes } from "./routes/plans.js";
import { templateRoutes } from "./routes/templates.js";
import { orderRoutes } from "./routes/orders.js";
import { reportRoutes } from "./routes/reports.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { createSmtpMailer, type Mailer } from "./lib/mailer.js";

export type HealthCheck = () => Promise<boolean>;

/** Orígenes permitidos: los explícitos y cualquier subdominio del dominio raíz (las páginas de los negocios). */
export function originAllowed(origin: string | undefined, config: Pick<Config, "FRONTEND_ORIGIN" | "ROOT_DOMAIN">): boolean {
  if (!origin) return true; // llamadas sin navegador (curl, servidor a servidor)
  const explicit = config.FRONTEND_ORIGIN.split(",").map((o) => o.trim());
  if (explicit.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    const root = config.ROOT_DOMAIN.toLowerCase();
    return hostname === root || hostname.endsWith(`.${root}`);
  } catch {
    return false;
  }
}

export interface AppDeps { mailer?: Mailer }

export function buildApp(config: Config, dbCheck: HealthCheck = async () => true, db?: Db, deps: AppDeps = {}) {
  const app = Fastify({ logger: config.NODE_ENV !== "test", trustProxy: config.NODE_ENV === "production" });

  app.register(cors, {
    origin: (origin, cb) => cb(null, originAllowed(origin, config)),
    credentials: true,
    // El plugin permite solo GET, HEAD y POST por defecto: sin esto el navegador bloquea el guardado (PUT).
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
  });
  app.register(cookie);
  app.register(rateLimit, { global: false });

  // Las rutas van dentro de un register para cargarse DESPUÉS del rate limit (si no, se ignora).
  app.register(async (api) => {
    api.get("/api/health", async (_req, reply) => {
      let ok = false;
      try {
        ok = await dbCheck();
      } catch {
        ok = false;
      }
      return reply.code(ok ? 200 : 503).send({ status: ok ? "ok" : "degraded", db: ok });
    });

    templateRoutes(api);

    if (db) {
      publicRoutes(api, db);
      planRoutes(api, db);
      orderRoutes(api, db, config.ORDERS_PER_MINUTE);
      reportRoutes(api, db, config.REPORTS_PER_MINUTE);
      // Contexto propio: el chequeo de origen de /auth no debe afectar a las rutas públicas (pedidos, denuncias).
      const mailer = deps.mailer ?? createSmtpMailer(config);
      api.register(async (authScope) => authRoutes(authScope, db, config, mailer));
      api.register(async (meScope) => meRoutes(meScope, db, config));
    }
  });

  return app;
}
