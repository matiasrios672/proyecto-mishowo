import type { FastifyReply, FastifyRequest } from "fastify";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import { can, type AreaKey, type Level } from "../lib/permissions.js";
import { ADMIN_ROLES, currentSession, isAdminRole, type SessionRow, type SessionUser } from "../auth/session.js";

export type AdminRole = (typeof ADMIN_ROLES)[number];
export interface AdminCtx { user: SessionUser; session: SessionRow; ip: string }

export const ipAllowed = (config: Pick<Config, "ADMIN_ALLOWED_IPS">, ip: string) => {
  const list = (config.ADMIN_ALLOWED_IPS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return list.length === 0 || list.includes(ip);
};

/** Sesión + rol de administración + IP permitida, SIN exigir todavía el segundo factor (para configurarlo y verificarlo). */
export async function requireAdminSession(db: Db, config: Config, req: FastifyRequest, reply: FastifyReply): Promise<AdminCtx | null> {
  const found = await currentSession(db, req);
  if (!found) { reply.code(401).send({ error: "unauthorized" }); return null; }
  if (!ipAllowed(config, req.ip)) { reply.code(403).send({ error: "ip_not_allowed" }); return null; }
  if (!isAdminRole(found.user.role)) { reply.code(403).send({ error: "forbidden" }); return null; }
  return { ...found, ip: req.ip };
}

/**
 * Acceso completo al admin: rol de administración, segundo factor verificado hace menos de `ADMIN_VERIFY_HOURS`
 * y, si se pide, un rol puntual (Soporte no puede tocar planes ni pagos).
 */
export async function requireAdmin(db: Db, config: Config, req: FastifyRequest, reply: FastifyReply, allow: readonly AdminRole[] = ADMIN_ROLES): Promise<AdminCtx | null> {
  const ctx = await requireAdminSession(db, config, req, reply);
  if (!ctx) return null;
  const verified = ctx.session.adminVerifiedAt && Date.now() - ctx.session.adminVerifiedAt.getTime() < config.ADMIN_VERIFY_HOURS * 3600_000;
  if (!ctx.user.totpEnabledAt || !verified) {
    reply.code(401).send({ error: "admin_2fa_required", totpEnabled: !!ctx.user.totpEnabledAt });
    return null;
  }
  if (!(allow as readonly string[]).includes(ctx.user.role)) { reply.code(403).send({ error: "forbidden_role" }); return null; }
  return ctx;
}

/** Igual que requireAdmin, pero exige un permiso por área (ver o gestionar) en vez de un rol. El Owner siempre pasa. */
export async function requirePerm(db: Db, config: Config, req: FastifyRequest, reply: FastifyReply, area: AreaKey, level: Level = "view"): Promise<AdminCtx | null> {
  const ctx = await requireAdmin(db, config, req, reply);
  if (!ctx) return null;
  if (!can(ctx.user, area, level)) { reply.code(403).send({ error: "forbidden_role", area, level }); return null; }
  return ctx;
}
