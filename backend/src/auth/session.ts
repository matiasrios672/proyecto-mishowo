import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, gt } from "drizzle-orm";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { newToken, sha256 } from "../lib/security.js";

export const SESSION_COOKIE = "ms_session";

export type SessionUser = typeof s.users.$inferSelect;

export interface PublicUser { id: string; email: string; name: string | null; emailVerified: boolean; role: string }

export const toPublicUser = (u: SessionUser): PublicUser => ({
  id: u.id, email: u.email, name: u.name, emailVerified: u.emailVerifiedAt !== null, role: u.role,
});

function cookieOptions(config: Config, maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  };
}

/** Crea la sesión y la deja en una cookie httpOnly. En la DB solo se guarda el hash del token. */
export const ADMIN_ROLES = ["owner", "admin", "support"] as const;
export const isAdminRole = (role: string) => (ADMIN_ROLES as readonly string[]).includes(role);

export async function startSession(db: Db, config: Config, reply: FastifyReply, userId: string, role = "user") {
  const token = newToken();
  // Las sesiones de administración duran mucho menos que las de los usuarios.
  const maxAge = isAdminRole(role) ? Math.round(config.ADMIN_SESSION_HOURS * 3600) : config.SESSION_DAYS * 24 * 3600;
  await db.insert(s.sessions).values({ id: sha256(token), userId, expiresAt: new Date(Date.now() + maxAge * 1000) });
  reply.setCookie(SESSION_COOKIE, token, cookieOptions(config, maxAge));
}

export async function endSession(db: Db, config: Config, req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) await db.delete(s.sessions).where(eq(s.sessions.id, sha256(token)));
  reply.clearCookie(SESSION_COOKIE, cookieOptions(config, 0));
}

export async function endAllSessions(db: Db, userId: string) {
  await db.delete(s.sessions).where(eq(s.sessions.userId, userId));
}

/** Usuario de la sesión actual, o null si no hay sesión válida, venció o el usuario está bloqueado. */
export async function currentUser(db: Db, req: FastifyRequest): Promise<SessionUser | null> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const rows = await db
    .select({ user: s.users })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .where(and(eq(s.sessions.id, sha256(token)), gt(s.sessions.expiresAt, new Date())));
  const user = rows[0]?.user ?? null;
  return user && !user.blockedAt ? user : null;
}

export type SessionRow = typeof s.sessions.$inferSelect;

/** Usuario y fila de sesión actuales (la fila trae si pasó el segundo factor de administración). */
export async function currentSession(db: Db, req: FastifyRequest): Promise<{ user: SessionUser; session: SessionRow } | null> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const rows = await db.select({ user: s.users, session: s.sessions }).from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .where(and(eq(s.sessions.id, sha256(token)), gt(s.sessions.expiresAt, new Date())));
  const row = rows[0];
  return row && !row.user.blockedAt ? row : null;
}

/** Devuelve el usuario o responde 401. Las rutas que lo usan: `const user = await requireUser(...); if (!user) return;` */
export async function requireUser(db: Db, req: FastifyRequest, reply: FastifyReply): Promise<SessionUser | null> {
  const user = await currentUser(db, req);
  if (!user) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return user;
}

/**
 * Defensa CSRF para rutas con cookie: en pedidos que modifican datos, el Origin tiene que ser
 * uno de los orígenes explícitos del sitio (NO los subdominios de negocios) y tiene que venir.
 */
export function strictOriginOk(config: Pick<Config, "FRONTEND_ORIGIN">, req: FastifyRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.origin;
  if (!origin) return false;
  return config.FRONTEND_ORIGIN.split(",").map((o) => o.trim()).includes(origin);
}
