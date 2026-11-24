import type { FastifyRequest } from "fastify";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";

/** Una cuenta puede tener varias páginas (cada una con su plan y su vencimiento). Tope para que nadie llene la base. */
export const MAX_PAGES_PER_ACCOUNT = 10;
/** Valor del encabezado `x-business-id` para crear una página nueva en el próximo guardado. */
export const NEW_PAGE = "new";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Página que la persona tiene abierta en su panel: el encabezado `x-business-id` (un uuid, o «new»). Sin encabezado, la primera. */
export function pageSelector(req: FastifyRequest): string | null {
  const h = req.headers["x-business-id"];
  const v = Array.isArray(h) ? h[0] : h;
  return v && (v === NEW_PAGE || UUID.test(v)) ? v : null;
}

/** Filtro «páginas de esta persona»; con una elegida, solo esa (si no es suya, no devuelve nada). */
export const ownedWhere = (userId: string, sel: string | null) =>
  and(eq(s.businesses.ownerId, userId), isNull(s.businesses.deletedAt), sel && sel !== NEW_PAGE ? eq(s.businesses.id, sel) : undefined);

/** La página activa de la persona (la elegida o, sin elección, la más antigua). */
export async function activePage(db: Db, userId: string, sel: string | null) {
  if (sel === NEW_PAGE) return null;
  const [b] = await db.select().from(s.businesses).where(ownedWhere(userId, sel)).orderBy(asc(s.businesses.createdAt)).limit(1);
  return b ?? null;
}
