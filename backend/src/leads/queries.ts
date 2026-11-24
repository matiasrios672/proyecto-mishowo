import { sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/tenant.js";

export const STAGES = ["sin_verificar", "sin_pagina", "borrador", "publicado"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  sin_verificar: "Registrado, sin confirmar email",
  sin_pagina: "Confirmó el email, sin página",
  borrador: "Armó una página, sin publicar",
  publicado: "Página publicada",
};

/** Base de contactos: cada cuenta de cliente con la etapa en la que quedó. Las cuentas del equipo no son leads. */
const BASE = sql`
  from users u
  left join lateral (
    select b.id, b.name, b.slug, b.industry, b.status, b.plan_id from businesses b
    where b.owner_id = u.id and b.deleted_at is null order by b.created_at limit 1
  ) b on true
  where u.role = 'user'`;

const STAGE_SQL = sql`case
  when b.status = 'published' then 'publicado'
  when b.id is not null then 'borrador'
  when u.email_verified_at is null then 'sin_verificar'
  else 'sin_pagina' end`;

export interface LeadFilter { stage?: Stage; q?: string; olderThanDays?: number }

function where(f: LeadFilter): SQL {
  const parts: SQL[] = [];
  if (f.stage) parts.push(sql`and (${STAGE_SQL}) = ${f.stage}`);
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, "\\$&")}%`;
    parts.push(sql`and (u.email ilike ${like} or coalesce(u.name, '') ilike ${like} or coalesce(u.last_name, '') ilike ${like} or coalesce(u.phone, '') ilike ${like} or coalesce(b.name, '') ilike ${like})`);
  }
  if (f.olderThanDays) parts.push(sql`and u.created_at < now() - make_interval(days => ${f.olderThanDays})`);
  return parts.length ? sql.join(parts, sql` `) : sql``;
}

export interface LeadRow {
  id: string; email: string; name: string | null; lastName: string | null; phone: string | null; createdAt: Date; lastLoginAt: Date | null; verified: boolean;
  stage: Stage; businessName: string | null; slug: string | null; industry: string | null; planId: string | null;
  source: string | null; lastNudgeAt: Date | null; optedOut: boolean; blocked: boolean;
}

const SELECT = sql`select u.id, u.email, u.name, u.last_name, u.phone, u.created_at, u.last_login_at, (u.email_verified_at is not null) as verified,
  (${STAGE_SQL}) as stage, b.name as business_name, b.slug, b.industry, b.plan_id, u.signup_source as source,
  u.last_nudge_at, (u.newsletter_optout_at is not null) as opted_out, (u.blocked_at is not null) as blocked`;

type Raw = Record<string, unknown>;
const toRow = (r: Raw): LeadRow => ({
  id: r.id as string, email: r.email as string, name: (r.name as string | null) ?? null, lastName: (r.last_name as string | null) ?? null, phone: (r.phone as string | null) ?? null, createdAt: new Date(r.created_at as string),
  lastLoginAt: r.last_login_at ? new Date(r.last_login_at as string) : null, verified: !!r.verified, stage: r.stage as Stage,
  businessName: (r.business_name as string | null) ?? null, slug: (r.slug as string | null) ?? null, industry: (r.industry as string | null) ?? null,
  planId: (r.plan_id as string | null) ?? null, source: (r.source as string | null) ?? null,
  lastNudgeAt: r.last_nudge_at ? new Date(r.last_nudge_at as string) : null, optedOut: !!r.opted_out, blocked: !!r.blocked,
});

export async function listLeads(db: Db, f: LeadFilter, limit: number, offset: number): Promise<{ rows: LeadRow[]; total: number }> {
  const w = where(f);
  const [rows, total] = await Promise.all([
    db.execute(sql`${SELECT} ${BASE} ${w} order by u.created_at desc limit ${limit} offset ${offset}`),
    db.execute(sql`select count(*)::int as n ${BASE} ${w}`),
  ]);
  return { rows: (rows.rows as Raw[]).map(toRow), total: Number((total.rows[0] as Raw | undefined)?.n ?? 0) };
}

export async function leadCounts(db: Db): Promise<Record<Stage, number>> {
  const r = await db.execute(sql`select (${STAGE_SQL}) as stage, count(*)::int as n ${BASE} group by 1`);
  const out = { sin_verificar: 0, sin_pagina: 0, borrador: 0, publicado: 0 } as Record<Stage, number>;
  for (const row of r.rows as Raw[]) out[row.stage as Stage] = Number(row.n);
  return out;
}

export async function sourceCounts(db: Db): Promise<{ source: string; n: number }[]> {
  const r = await db.execute(sql`select coalesce(u.signup_source, 'directo') as source, count(*)::int as n ${BASE} group by 1 order by n desc limit 10`);
  return (r.rows as Raw[]).map((x) => ({ source: String(x.source), n: Number(x.n) }));
}

export async function allLeads(db: Db, f: LeadFilter, cap = 20_000): Promise<LeadRow[]> {
  const r = await db.execute(sql`${SELECT} ${BASE} ${where(f)} order by u.created_at desc limit ${cap}`);
  return (r.rows as Raw[]).map(toRow);
}

export async function leadById(db: Db, id: string): Promise<LeadRow | null> {
  const r = await db.execute(sql`${SELECT} ${BASE} and u.id = ${id}`);
  const row = (r.rows as Raw[])[0];
  return row ? toRow(row) : null;
}
