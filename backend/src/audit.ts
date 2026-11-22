import type { Db } from "./db/tenant.js";
import * as s from "./db/schema.js";

type Writer = Pick<Db, "insert">;

export interface AuditEntry {
  actorId: string | null;
  action: string;        // ej. "payment.confirm", "business.suspend"
  entity: string;        // ej. "payment", "business", "user", "plan"
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/** Registra una acción de administración. Se llama dentro de la misma transacción que el cambio. */
export async function audit(db: Writer, e: AuditEntry) {
  await db.insert(s.auditLog).values({
    actorId: e.actorId, action: e.action, entity: e.entity, entityId: e.entityId,
    before: (e.before ?? null) as never, after: (e.after ?? null) as never, ip: e.ip ?? null,
  });
}
