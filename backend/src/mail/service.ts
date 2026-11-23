import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import type { Mail, Mailer } from "../lib/mailer.js";
import { TEMPLATE_BY_KEY, render, type TemplateDef } from "./templates.js";

export const MAX_RECIPIENTS = 2000;

export interface Effective { def: TemplateDef; subject: string; body: string; enabled: boolean; customized: boolean }

/** Plantilla vigente: la que editó el sysadmin o, si no hay, la de fábrica. */
export async function loadTemplate(db: Db, key: string): Promise<Effective | null> {
  const def = TEMPLATE_BY_KEY.get(key);
  if (!def) return null;
  const [row] = await db.select().from(s.emailTemplates).where(eq(s.emailTemplates.key, key));
  if (!row) return { def, subject: def.subject, body: def.body, enabled: !def.defaultOff, customized: false };
  // Las plantillas "locked" (confirmación, recuperar contraseña, arrepentimiento) no se pueden apagar nunca.
  return { def, subject: row.subject, body: row.body, enabled: def.locked ? true : row.enabled, customized: true };
}

export async function renderTemplate(db: Db, key: string, vars: Record<string, string>): Promise<(Mail & { enabled: boolean }) | null> {
  const t = await loadTemplate(db, key);
  if (!t) return null;
  const r = render({ subject: t.subject, body: t.body, ...(t.def.cta ? { cta: t.def.cta } : {}) }, vars);
  return { to: "", subject: r.subject, text: r.text, html: r.html, enabled: t.enabled };
}

/** Manda un mail de plantilla. Devuelve false si el sysadmin lo apagó. Un error de SMTP no se propaga: nunca tumba el flujo que lo disparó. */
export async function sendTemplate(db: Db, mailer: Mailer, key: string, to: string, vars: Record<string, string>, onError?: (e: unknown) => void): Promise<boolean> {
  try {
    const r = await renderTemplate(db, key, vars);
    if (!r || !r.enabled) return false;
    await mailer.send({ to, subject: r.subject, text: r.text, ...(r.html ? { html: r.html } : {}) });
    return true;
  } catch (e) {
    onError?.(e);
    return false;
  }
}

// ───────────────────────── Baja de novedades (enlace firmado, sin sesión) ─────────────────────────
const sign = (secret: string, userId: string) => createHmac("sha256", secret).update(`unsub:${userId}`).digest("hex").slice(0, 32);
export const unsubscribeToken = (secret: string, userId: string) => `${userId}.${sign(secret, userId)}`;
export function readUnsubscribeToken(secret: string, token: string): string | null {
  const [id, sig] = token.split(".");
  if (!id || !sig || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const want = Buffer.from(sign(secret, id)), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

// ───────────────────────── Comunicados ─────────────────────────
export const SEGMENTS = [
  { key: "todos", label: "Todos los usuarios", help: "Cuentas con email confirmado." },
  { key: "gratis", label: "Plan gratis", help: "Dueños de negocios en el plan gratuito." },
  { key: "pago", label: "Planes pagos", help: "Dueños con un plan pago vigente." },
  { key: "por_vencer", label: "Planes por vencer (7 días)", help: "Pago vigente que vence en la próxima semana." },
  { key: "publicados", label: "Con página publicada", help: "Negocios publicados." },
  { key: "sin_publicar", label: "Todavía sin publicar", help: "Tienen cuenta pero su página no está publicada." },
  { key: "sin_pagina", label: "Sin página creada", help: "Se registraron pero no guardaron ningún negocio." },
  { key: "equipo", label: "Equipo MiShowo", help: "Owner, administradores y soporte." },
] as const;
export type SegmentKey = (typeof SEGMENTS)[number]["key"];
export const SEGMENT_KEYS = SEGMENTS.map((x) => x.key) as [SegmentKey, ...SegmentKey[]];

export interface Recipient { id: string; email: string; name: string | null }

/** Destinatarios de un segmento. Las "novedades" excluyen a quien se dio de baja; los avisos de servicio llegan siempre. */
export async function segmentRecipients(db: Db, segment: SegmentKey, kind: "servicio" | "novedades"): Promise<Recipient[]> {
  const now = new Date();
  const base = [isNull(s.users.blockedAt)];
  if (kind === "novedades") base.push(isNull(s.users.newsletterOptoutAt));
  const pick = { id: s.users.id, email: s.users.email, name: s.users.name };
  const live = isNull(s.businesses.deletedAt);
  let rows: Recipient[];
  switch (segment) {
    case "equipo":
      rows = await db.select(pick).from(s.users).where(and(...base, inArray(s.users.role, ["owner", "admin", "support"])));
      break;
    case "sin_pagina":
      rows = await db.select(pick).from(s.users).where(and(...base, eq(s.users.role, "user"), isNotNull(s.users.emailVerifiedAt),
        sql`not exists (select 1 from ${s.businesses} b where b.owner_id = ${s.users.id} and b.deleted_at is null)`));
      break;
    default: {
      const where = {
        todos: undefined,
        gratis: and(live, eq(s.businesses.planId, "gratis")),
        pago: and(live, ne(s.businesses.planId, "gratis"), gt(s.businesses.planExpiresAt, now)),
        por_vencer: and(live, ne(s.businesses.planId, "gratis"), gt(s.businesses.planExpiresAt, now), lte(s.businesses.planExpiresAt, new Date(now.getTime() + 7 * 86_400_000))),
        publicados: and(live, eq(s.businesses.status, "published")),
        sin_publicar: and(live, ne(s.businesses.status, "published")),
      }[segment];
      if (segment === "todos") rows = await db.select(pick).from(s.users).where(and(...base, eq(s.users.role, "user"), isNotNull(s.users.emailVerifiedAt)));
      else rows = await db.select(pick).from(s.users).innerJoin(s.businesses, eq(s.businesses.ownerId, s.users.id))
        .where(and(...base, isNotNull(s.users.emailVerifiedAt), where));
    }
  }
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))).slice(0, MAX_RECIPIENTS);
}

export interface SendCtx { db: Db; mailer: Mailer; appUrl: string; secret: string; log?: (m: string) => void }

/** Manda un comunicado. Se "reclama" con un UPDATE atómico: dos corridas a la vez (cron + botón) no lo duplican. */
export async function runCampaign(ctx: SendCtx, id: string): Promise<{ sent: number; failed: number } | null> {
  const { db } = ctx;
  const [c] = await db.update(s.emailCampaigns).set({ status: "enviando" })
    .where(and(eq(s.emailCampaigns.id, id), inArray(s.emailCampaigns.status, ["borrador", "programado"]))).returning();
  if (!c) return null;
  const recipients = await segmentRecipients(db, c.segment as SegmentKey, c.kind as "servicio" | "novedades");
  let sent = 0, failed = 0;
  for (const r of recipients) {
    const unsubscribeUrl = c.kind === "novedades" ? `${ctx.appUrl}/baja?token=${encodeURIComponent(unsubscribeToken(ctx.secret, r.id))}` : undefined;
    const out = render({ subject: c.subject, body: c.body }, { name: r.name ?? "", email: r.email }, unsubscribeUrl ? { unsubscribeUrl } : {});
    try { await ctx.mailer.send({ to: r.email, subject: out.subject, text: out.text, html: out.html }); sent++; }
    catch (e) { failed++; ctx.log?.(`comunicado ${id}: falló ${r.email}: ${String(e)}`); }
  }
  await db.update(s.emailCampaigns).set({ status: "enviado", sentAt: new Date(), recipients: sent, failed }).where(eq(s.emailCampaigns.id, id));
  return { sent, failed };
}

/** Para el cron: manda los comunicados programados cuya hora ya llegó. */
export async function sendDueCampaigns(ctx: SendCtx, now = new Date()): Promise<number> {
  const due = await ctx.db.select({ id: s.emailCampaigns.id }).from(s.emailCampaigns)
    .where(and(eq(s.emailCampaigns.status, "programado"), lte(s.emailCampaigns.scheduledAt, now))).orderBy(asc(s.emailCampaigns.scheduledAt)).limit(20);
  let n = 0;
  for (const { id } of due) if (await runCampaign(ctx, id)) n++;
  return n;
}
