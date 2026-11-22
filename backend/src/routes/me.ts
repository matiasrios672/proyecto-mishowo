import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import { contentSchema } from "../business/content.js";
import { loadContent, saveContent } from "../business/sync.js";
import { requireUser, strictOriginOk } from "../auth/session.js";

const putBody = z.object({
  // Versión que el editor cree tener. null = todavía no existe el negocio en el servidor.
  baseVersion: z.number().int().min(0).nullable(),
  content: contentSchema,
});

export function meRoutes(app: FastifyInstance, db: Db, config: Config) {
  // CSRF: solo pedidos que vengan del sitio principal.
  app.addHook("onRequest", async (req, reply) => {
    if (!strictOriginOk(config, req)) return reply.code(403).send({ error: "bad_origin" });
  });

  app.get("/me/business", async (req, reply) => {
    const user = await requireUser(db, req, reply);
    if (!user) return;
    reply.header("Cache-Control", "no-store");
    return (await loadContent(db, user.id)) ?? { business: null, content: null };
  });

  // Guardado del editor (autoguardado): permite hasta ~4 pedidos por segundo, no más.
  app.put("/me/business", { config: { rateLimit: { max: 240, timeWindow: "1 minute" } }, bodyLimit: 2 * 1024 * 1024 }, async (req, reply) => {
    const user = await requireUser(db, req, reply);
    if (!user) return;
    const parsed = putBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_content", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) });
    const result = await saveContent(db, user.id, parsed.data.baseVersion, parsed.data.content);
    if (result.status === "conflict") return reply.code(409).send({ error: "version_conflict", version: result.version });
    return reply.code(result.created ? 201 : 200).send({ version: result.version });
  });
}
