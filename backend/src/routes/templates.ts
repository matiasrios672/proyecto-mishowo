import type { FastifyInstance } from "fastify";
import type { Db } from "../db/tenant.js";
import { INDUSTRIES, getIndustry } from "../templates/industries.js";
import { getOverrides, isHidden, withOverride, type Override } from "../templates/overrides.js";

export function templateRoutes(app: FastifyInstance, db?: Db) {
  const overridesOf = async (): Promise<Record<string, Override>> => (db ? getOverrides(db) : {}); // sin base (modo de arranque) se ofrecen los rubros de fábrica
  // Los rubros que se ofrecen, con los cambios que hizo el equipo desde el admin (nombre, tema, diseño…).
  app.get("/public/templates", async (_req, reply) => {
    const overrides = await overridesOf();
    reply.header("Cache-Control", "public, max-age=60");
    
    return INDUSTRIES.filter((t) => !isHidden(t.id, overrides[t.id])).map((t) => withOverride(t, overrides[t.id]))
      .map(({ id, name, blurb, mode, layout, theme }) => ({ id, name, blurb, mode, layout, theme }));
  });

  app.get<{ Params: { id: string } }>("/public/templates/:id", async (req, reply) => {
    const t = getIndustry(req.params.id);
    const overrides = await overridesOf();
    if (!t || isHidden(t.id, overrides[t.id])) return reply.code(404).send({ error: "not_found" });
    reply.header("Cache-Control", "public, max-age=60");
    return withOverride(t, overrides[t.id]);
  });
}
