import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import type { Mailer } from "../lib/mailer.js";
import { normalizeWhatsapp } from "../lib/whatsapp.js";
import { hashPassword, newToken, sha256, verifyPassword } from "../lib/security.js";
import { sendTemplate } from "../mail/service.js";
import { currentUser, endAllSessions, endSession, requireUser, startSession, strictOriginOk, toPublicUser } from "../auth/session.js";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, "too_short").max(128);
const token = z.string().min(20).max(200);

type TokenType = "verify" | "reset" | "magic";
const TTL: Record<TokenType, number> = { verify: 24 * 3600_000, reset: 3600_000, magic: 15 * 60_000 };

/** Emite un token de un solo uso e invalida los anteriores del mismo tipo para ese email. */
async function issueToken(db: Db, type: TokenType, mail: string, userId: string | null): Promise<string> {
  const raw = newToken();
  await db.update(s.authTokens).set({ usedAt: new Date() })
    .where(and(eq(s.authTokens.email, mail), eq(s.authTokens.type, type), isNull(s.authTokens.usedAt)));
  await db.insert(s.authTokens).values({ userId, email: mail, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + TTL[type]) });
  return raw;
}

/** Consume un token de forma atómica: si dos pedidos llegan a la vez, solo uno gana. */
async function consumeToken(db: Db, type: TokenType, raw: string) {
  const rows = await db.update(s.authTokens).set({ usedAt: new Date() })
    .where(and(eq(s.authTokens.tokenHash, sha256(raw)), eq(s.authTokens.type, type), isNull(s.authTokens.usedAt), gt(s.authTokens.expiresAt, new Date())))
    .returning();
  return rows[0] ?? null;
}

export function authRoutes(app: FastifyInstance, db: Db, config: Config, mailer: Mailer) {
  const limit = { config: { rateLimit: { max: config.AUTH_PER_MINUTE, timeWindow: "1 minute" } } };
  const link = (path: string, t: string) => `${config.APP_URL}${path}?token=${encodeURIComponent(t)}`;

  // CSRF: las rutas de cuenta solo aceptan pedidos que vengan del sitio principal.
  app.addHook("onRequest", async (req: FastifyRequest, reply) => {
    if (!strictOriginOk(config, req)) return reply.code(403).send({ error: "bad_origin" });
  });

  // Los textos salen de las plantillas editables (mail/templates.ts); un fallo de SMTP se registra y no tumba el pedido.
  const sendT = (key: string, to: string, vars: Record<string, string>) =>
    sendTemplate(db, mailer, key, to, vars, (e) => app.log.error({ err: e }, "no se pudo enviar el email"));

  app.get("/auth/me", async (req) => {
    const u = await currentUser(db, req);
    return { user: u ? toPublicUser(u) : null };
  });

  app.post("/auth/register", limit, async (req, reply) => {
    const p = z.object({ email, password, name: z.string().trim().min(2).max(80), lastName: z.string().trim().min(2).max(80), phone: z.string().trim().min(6).max(30), source: z.string().trim().toLowerCase().max(60).regex(/^[a-z0-9._:\-\/ ]*$/).optional(), ref: z.string().trim().toLowerCase().regex(/^[a-z0-9]{6,12}$/).optional() }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.issues.some((i) => i.message === "too_short") ? "password_too_short" : "invalid_request" });
    if (p.data.password.toLowerCase() === p.data.email) return reply.code(400).send({ error: "password_is_email" });
    const phone = normalizeWhatsapp(p.data.phone);
    if (!phone) return reply.code(400).send({ error: "invalid_phone" });

    const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, p.data.email));
    if (exists) return reply.code(409).send({ error: "email_taken" });

    // Código de quien lo invitó: si no existe, se ignora (nunca es motivo para rechazar un registro).
    const referrer = p.data.ref ? (await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.referralCode, p.data.ref)))[0] : undefined;
    const [user] = await db.insert(s.users).values({
      email: p.data.email, name: p.data.name, lastName: p.data.lastName, phone, passwordHash: await hashPassword(p.data.password), signupSource: referrer ? "referido" : p.data.source || null, referredBy: referrer?.id ?? null,
    }).onConflictDoNothing().returning();
    if (!user) return reply.code(409).send({ error: "email_taken" }); // carrera entre dos registros

    await startSession(db, config, reply, user.id);
    await sendT("verify", user.email, { link: link("/verificar", await issueToken(db, "verify", user.email, user.id)) });
    return reply.code(201).send({ user: toPublicUser(user) });
  });

  app.post("/auth/login", limit, async (req, reply) => {
    const p = z.object({ email, password: z.string().min(1).max(128) }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const [user] = await db.select().from(s.users).where(eq(s.users.email, p.data.email));
    const ok = await verifyPassword(p.data.password, user?.passwordHash ?? null);
    if (!user || !ok) return reply.code(401).send({ error: "invalid_credentials" });
    if (user.blockedAt) return reply.code(403).send({ error: "blocked" });
    await db.update(s.users).set({ lastLoginAt: new Date() }).where(eq(s.users.id, user.id));
    await startSession(db, config, reply, user.id, user.role);
    return { user: toPublicUser(user) };
  });

  app.post("/auth/logout", async (req, reply) => {
    await endSession(db, config, req, reply);
    return { ok: true };
  });

  app.post("/auth/verify", limit, async (req, reply) => {
    const p = z.object({ token }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_token" });
    const t = await consumeToken(db, "verify", p.data.token);
    if (!t?.userId) return reply.code(400).send({ error: "invalid_token" });
    const [was] = await db.select({ at: s.users.emailVerifiedAt, email: s.users.email }).from(s.users).where(eq(s.users.id, t.userId));
    await db.update(s.users).set({ emailVerifiedAt: sql`coalesce(${s.users.emailVerifiedAt}, now())` }).where(eq(s.users.id, t.userId));
    if (was && !was.at) await sendT("welcome", was.email, { link: `${config.APP_URL}/panel` }); // solo la primera vez
    return { ok: true };
  });

  app.post("/auth/resend-verification", { config: { rateLimit: { max: Math.min(3, config.AUTH_PER_MINUTE), timeWindow: "1 minute" } } }, async (req, reply) => {
    const user = await requireUser(db, req, reply);
    if (!user) return;
    if (user.emailVerifiedAt) return { ok: true, alreadyVerified: true };
    await sendT("verify", user.email, { link: link("/verificar", await issueToken(db, "verify", user.email, user.id)) });
    return { ok: true };
  });

  // Siempre responde igual, exista o no la cuenta: no revela qué emails están registrados.
  app.post("/auth/forgot", limit, async (req, reply) => {
    const p = z.object({ email }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const [user] = await db.select().from(s.users).where(eq(s.users.email, p.data.email));
    if (user && !user.blockedAt) await sendT("reset", user.email, { link: link("/restablecer", await issueToken(db, "reset", user.email, user.id)) });
    return { ok: true };
  });

  app.post("/auth/reset", limit, async (req, reply) => {
    const p = z.object({ token, password }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.issues.some((i) => i.message === "too_short") ? "password_too_short" : "invalid_request" });
    const t = await consumeToken(db, "reset", p.data.token);
    if (!t?.userId) return reply.code(400).send({ error: "invalid_token" });
    await db.update(s.users).set({ passwordHash: await hashPassword(p.data.password), emailVerifiedAt: sql`coalesce(${s.users.emailVerifiedAt}, now())` })
      .where(eq(s.users.id, t.userId));
    await endAllSessions(db, t.userId); // si alguien más tenía la sesión abierta, se cierra
    return { ok: true };
  });

  app.post("/auth/magic", limit, async (req, reply) => {
    const p = z.object({ email }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_request" });
    const [user] = await db.select().from(s.users).where(eq(s.users.email, p.data.email));
    if (!user?.blockedAt) await sendT("magic", p.data.email, { link: link("/enlace", await issueToken(db, "magic", p.data.email, user?.id ?? null)) });
    return { ok: true };
  });

  // Entrar con el enlace prueba que el email es de la persona: crea la cuenta si no existía.
  app.post("/auth/magic/consume", limit, async (req, reply) => {
    const p = z.object({ token }).safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: "invalid_token" });
    const t = await consumeToken(db, "magic", p.data.token);
    if (!t) return reply.code(400).send({ error: "invalid_token" });
    let [user] = await db.select().from(s.users).where(eq(s.users.email, t.email));
    if (user?.blockedAt) return reply.code(403).send({ error: "blocked" });
    if (!user) [user] = await db.insert(s.users).values({ email: t.email, emailVerifiedAt: new Date() }).onConflictDoNothing().returning();
    if (!user) [user] = await db.select().from(s.users).where(eq(s.users.email, t.email));
    if (!user) return reply.code(400).send({ error: "invalid_token" });
    const [fresh] = await db.update(s.users)
      .set({ emailVerifiedAt: sql`coalesce(${s.users.emailVerifiedAt}, now())`, lastLoginAt: new Date() })
      .where(eq(s.users.id, user.id)).returning();
    if (!fresh) return reply.code(400).send({ error: "invalid_token" });
    await startSession(db, config, reply, fresh.id, fresh.role);
    return { user: toPublicUser(fresh) };
  });
}
