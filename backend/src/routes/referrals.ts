import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { requireUser } from "../auth/session.js";
import { requirePerm } from "../admin/guard.js";

const newCode = () => randomBytes(5).toString("hex").slice(0, 8); // 8 caracteres en minúscula y números

/** Referidos: cada persona tiene un código para invitar. El premio por invitar lo decide el dueño del producto: acá solo se registra y se cuenta. */
export function referralPanelRoutes(app: FastifyInstance, db: Db, config: Pick<Config, "APP_URL">) {
  app.get("/me/referral", async (req, reply) => {
    const user = await requireUser(db, req, reply);
    if (!user) return;
    let [row] = await db.select({ code: s.users.referralCode }).from(s.users).where(eq(s.users.id, user.id));
    // Se genera la primera vez; si dos pedidos llegan a la vez o el código choca, se reintenta con otro.
    for (let i = 0; !row?.code && i < 5; i++) {
      await db.update(s.users).set({ referralCode: newCode() }).where(sql`${s.users.id} = ${user.id} and ${s.users.referralCode} is null`).catch(() => undefined);
      [row] = await db.select({ code: s.users.referralCode }).from(s.users).where(eq(s.users.id, user.id));
    }
    const code = row?.code;
    if (!code) return reply.code(503).send({ error: "try_again" });
    const rows = await db.execute(sql`select u.created_at, (b.id is not null) as has_page, coalesce(b.status = 'published', false) as published, coalesce(b.plan_id <> 'gratis', false) as paid
      from users u left join businesses b on b.owner_id = u.id and b.deleted_at is null where u.referred_by = ${user.id}`);
    const list = rows.rows as { has_page: boolean; published: boolean; paid: boolean }[];
    reply.header("Cache-Control", "no-store");
    return {
      code, link: `${config.APP_URL}/?ref=${code}`,
      invited: list.length, withPage: list.filter((r) => r.has_page).length, published: list.filter((r) => r.published).length, paid: list.filter((r) => r.paid).length,
    };
  });
}

/** Para el equipo: quiénes invitan más y cuántos de los invitados terminaron publicando o pagando. */
export function adminReferralRoutes(app: FastifyInstance, db: Db, config: Config) {
  app.get("/admin/referrals", async (req, reply) => {
    const ctx = await requirePerm(db, config, req, reply, "leads","view");
    if (!ctx) return;
    const rows = await db.execute(sql`select r.id, r.email, r.name, count(u.id)::int as invited,
        count(b.id) filter (where b.status = 'published')::int as published, count(b.id) filter (where b.plan_id <> 'gratis')::int as paid
      from users r join users u on u.referred_by = r.id
      left join businesses b on b.owner_id = u.id and b.deleted_at is null
      group by r.id, r.email, r.name order by invited desc, published desc limit 25`);
    const total = await db.execute(sql`select count(*)::int as n from users where referred_by is not null`);
    reply.header("Cache-Control", "no-store");
    return { totalReferred: Number((total.rows[0] as { n: number } | undefined)?.n ?? 0), top: rows.rows };
  });
}
