import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import type { Config } from "./config.js";
import type { Db } from "./db/tenant.js";
import { publicRoutes } from "./routes/public.js";
import { planRoutes } from "./routes/plans.js";
import { templateRoutes } from "./routes/templates.js";
import { orderRoutes } from "./routes/orders.js";
import { reportRoutes } from "./routes/reports.js";
import { publicReviewRoutes } from "./routes/reviews.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { contactRoutes } from "./routes/contact.js";
import { publicStatsRoutes } from "./routes/stats.js";
import { publicCouponRoutes } from "./routes/coupons.js";
import { publicAppointmentRoutes } from "./routes/appointments.js";
import { adminModerationRoutes } from "./routes/admin-moderation.js";
import { adminSystemRoutes, publicSiteConfigRoutes } from "./routes/admin-system.js";
import { adminStatsRoutes } from "./routes/admin-stats.js";
import { adminMailRoutes, publicMailRoutes } from "./routes/admin-mail.js";
import { adminLeadRoutes } from "./routes/admin-leads.js";
import { adminReferralRoutes } from "./routes/referrals.js";
import { adminIndustryRoutes } from "./routes/admin-industries.js";
import { getMaintenance, DEFAULT_MAINTENANCE_MESSAGE } from "./lib/settings.js";
import { adminRoutes } from "./routes/admin.js";
import { publicMediaRoutes } from "./routes/media.js";
import { createSmtpMailer, type Mailer } from "./lib/mailer.js";
import { createRevalidator, type SiteChanged } from "./lib/revalidate.js";
import { DiskStorage, type StorageProvider } from "./storage/index.js";
import { setMailBrand } from "./mail/templates.js";

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

export interface AppDeps { mailer?: Mailer; onSiteChanged?: SiteChanged; storage?: StorageProvider }

let storageSingleton: StorageProvider | undefined;

export function buildApp(config: Config, dbCheck: HealthCheck = async () => true, db?: Db, deps: AppDeps = {}) {
  setMailBrand(config.APP_URL); // el logo y los links de los mails salen del dominio configurado
  const app = Fastify({ logger: config.NODE_ENV !== "test", trustProxy: config.NODE_ENV === "production" });

  app.register(cors, {
    origin: (origin, cb) => cb(null, originAllowed(origin, config)),
    credentials: true,
    // El plugin permite solo GET, HEAD y POST por defecto: sin esto el navegador bloquea el guardado (PUT) y el cambio de estado (PATCH).
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  app.register(cookie);
  app.register(rateLimit, { global: false });
  // Subida de archivos: máx. 1 archivo por pedido y 12 MB (cada ruta aplica su propio tope más chico).
  app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 8 } });

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

    templateRoutes(api, db);

    if (db) {
      // Modo mantenimiento: frena SOLO los registros y los pedidos nuevos (503 con mensaje). Login, panel y admin siguen andando.
      api.addHook("onRequest", async (req, reply) => {
        if (req.method !== "POST") return;
        const p = req.url.split("?")[0];
        if (p !== "/auth/register" && p !== "/public/orders") return;
        const m = await getMaintenance(db);
        if (m.enabled) return reply.code(503).header("Retry-After", "300").send({ error: "maintenance", message: m.message || DEFAULT_MAINTENANCE_MESSAGE });
      });
      publicRoutes(api, db, config);
      publicSiteConfigRoutes(api, db);
      publicMediaRoutes(api, deps.storage ?? (storageSingleton ??= new DiskStorage(config.UPLOADS_DIR)));
      planRoutes(api, db);
      reportRoutes(api, db, config.REPORTS_PER_MINUTE);
      const mailer = deps.mailer ?? createSmtpMailer(config);
      orderRoutes(api, db, config.ORDERS_PER_MINUTE, mailer, config.APP_URL);
      contactRoutes(api, db, mailer, config.REPORTS_PER_MINUTE);
      publicReviewRoutes(api, db, config.REPORTS_PER_MINUTE, mailer, config.APP_URL);
      publicMailRoutes(api, db, config);
      publicStatsRoutes(api, db, config.EVENTS_PER_MINUTE);
      publicCouponRoutes(api, db, config.COUPONS_VALIDATE_PER_MINUTE);
      publicAppointmentRoutes(api, db, config.APPOINTMENTS_PER_MINUTE, mailer, config.APP_URL);
      // Contextos propios: el chequeo de origen de /auth y /me no debe afectar a las rutas públicas (pedidos, denuncias).
      api.register(async (authScope) => authRoutes(authScope, db, config, mailer));
      const notify = deps.onSiteChanged ?? createRevalidator(config, (m) => app.log.warn(m));
      const storage = deps.storage ?? new DiskStorage(config.UPLOADS_DIR);
      api.register(async (meScope) => meRoutes(meScope, db, config, notify, storage, mailer));
      api.register(async (adminScope) => {
        adminRoutes(adminScope, db, config, mailer, storage, notify);
        adminModerationRoutes(adminScope, db, config, notify);
        adminSystemRoutes(adminScope, db, config);
        adminStatsRoutes(adminScope, db, config);
        adminMailRoutes(adminScope, db, config, mailer);
        adminLeadRoutes(adminScope, db, config, mailer);
        adminReferralRoutes(adminScope, db, config);
        adminIndustryRoutes(adminScope, db, config);
      });
    }
  });

  return app;
}
