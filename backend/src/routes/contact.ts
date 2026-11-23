import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import type { Mailer } from "../lib/mailer.js";
import { sendTemplate } from "../mail/service.js";

const body = z.object({
  kind: z.enum(["arrepentimiento", "contacto"]),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  reference: z.string().trim().max(200).optional(),
  message: z.string().trim().max(1000).optional(),
});

export function contactRoutes(app: FastifyInstance, db: Db, mailer: Mailer, perMinute = 5) {
  app.post("/public/contact", { config: { rateLimit: { max: perMinute, timeWindow: "1 minute" } } }, async (req, reply) => {
    const p = body.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const [row] = await db.insert(s.contactRequests).values({
      kind: p.data.kind, name: p.data.name, email: p.data.email,
      reference: p.data.reference || null, message: p.data.message || null,
    }).returning({ id: s.contactRequests.id });
    // Acuse de recibo (plantilla editable): si el mail falla, el pedido igual quedó registrado.
    await sendTemplate(db, mailer, p.data.kind === "arrepentimiento" ? "regret_ack" : "contact_ack", p.data.email, { name: p.data.name, code: row!.id.slice(0, 8) },
      (e) => app.log.error({ err: e }, "no se pudo enviar el acuse de recibo"));
    return reply.code(201).send({ ok: true, code: row!.id.slice(0, 8) });
  });
}
