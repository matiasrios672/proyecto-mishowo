import type { FastifyInstance } from "fastify";
import { INDUSTRIES, getIndustry } from "../templates/industries.js";

export function templateRoutes(app: FastifyInstance) {
  app.get("/public/templates", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=300");
    return INDUSTRIES.map(({ id, name, blurb, mode, layout, theme }) => ({ id, name, blurb, mode, layout, theme }));
  });

  app.get<{ Params: { id: string } }>("/public/templates/:id", async (req, reply) => {
    const t = getIndustry(req.params.id);
    if (!t) return reply.code(404).send({ error: "not_found" });
    reply.header("Cache-Control", "public, max-age=300");
    return t;
  });
}
