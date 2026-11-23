import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import { audit } from "../audit.js";
import { requirePerm } from "../admin/guard.js";
import { putSetting } from "../lib/settings.js";
import { THEME_IDS, LAYOUT_IDS, FONT_PAIR_IDS } from "../lib/design.js";
import { INDUSTRIES, getIndustry } from "../templates/industries.js";
import { ALWAYS_VISIBLE, INDUSTRY_OVERRIDES_KEY, getOverrides, overrideSchema, type Override } from "../templates/overrides.js";


/** Catálogo de rubros editable por el equipo: nombre, bajada, tema, diseño y tipografía iniciales, y qué rubros se ofrecen. */
export function adminIndustryRoutes(app: FastifyInstance, db: Db, config: Config) {
  app.get("/admin/industries", async (req, reply) => {
    const ctx = await requirePerm(db, config, req, reply, "rubros","view");
    if (!ctx) return;
    const overrides = await getOverrides(db);
    reply.header("Cache-Control", "no-store");
    return {
      options: { themes: THEME_IDS, layouts: LAYOUT_IDS, fontPairs: FONT_PAIR_IDS },
      industries: INDUSTRIES.map((t) => ({
        id: t.id, mode: t.mode, locked: ALWAYS_VISIBLE.includes(t.id),
        defaults: { name: t.name, blurb: t.blurb, tagline: t.tagline, theme: t.theme, layout: t.layout, fontPair: t.fontPair },
        override: overrides[t.id] ?? {},
      })),
    };
  });

  app.put<{ Params: { id: string } }>("/admin/industries/:id", async (req, reply) => {
    const ctx = await requirePerm(db, config, req, reply, "rubros","manage");
    if (!ctx) return;
    if (!getIndustry(req.params.id)) return reply.code(404).send({ error: "not_found" });
    // Un campo vacío ("") vuelve al valor de fábrica.
    const clean = z.record(z.string(), z.unknown()).safeParse(req.body);
    if (!clean.success) return reply.code(400).send({ error: "invalid_request" });
    const body = Object.fromEntries(Object.entries(clean.data).filter(([, v]) => v !== "" && v !== null && v !== undefined));
    const p = overrideSchema.strict().safeParse(body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request", issues: p.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`) });
    if (p.data.hidden && ALWAYS_VISIBLE.includes(req.params.id)) return reply.code(422).send({ error: "always_visible" });
    const all = await getOverrides(db);
    const before = all[req.params.id] ?? null;
    const next: Record<string, Override> = { ...all };
    if (Object.keys(p.data).length === 0) delete next[req.params.id]; else next[req.params.id] = p.data;
    await putSetting(db, INDUSTRY_OVERRIDES_KEY, next);
    await audit(db, { actorId: ctx.user.id, action: "industry.update", entity: "industry", entityId: req.params.id, before, after: p.data, ip: ctx.ip });
    return { ok: true };
  });
}
