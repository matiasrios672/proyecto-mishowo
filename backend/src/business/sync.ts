import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import { defaultHours, type Content } from "./content.js";
import { productLimit, realProducts } from "./publish.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
const CHUNK = 300;
const chunks = <T,>(arr: T[], n = CHUNK) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));
const num = (v: number | null) => (v === null ? null : String(v));

export type SaveResult =
  | { status: "ok"; version: number; created: boolean; published: string | null }
  | { status: "conflict"; version: number }
  | { status: "limit"; limit: number; count: number };

export function businessColumns(c: Content) {
  return {
    name: c.name,
    industry: c.industryId,
    description: c.description,
    tagline: c.tagline,
    whatsapp: c.whatsapp,
    instagram: c.instagram,
    address: c.address,
    deliveryZone: c.deliveryZone,
    hours: c.hours,
    design: c.design,
    settings: {
      announcement: c.announcement, whatsappGreeting: c.whatsappGreeting, showQuantities: c.showQuantities, ordersEnabled: c.ordersEnabled,
      askEventDate: c.askEventDate, extraWhatsapps: c.extraWhatsapps, nameIsExample: c.nameIsExample, textsAreExample: c.textsAreExample,
    },
  };
}

/** Slug provisorio y válido. La persona elige el definitivo al publicar (Épica 7). */
const placeholderSlug = () => `mi-pagina-${randomBytes(4).toString("hex")}`;

/**
 * Guarda el documento del editor. Concurrencia: un lock por usuario serializa los guardados y
 * `baseVersion` tiene que coincidir con la versión del servidor; si no, hay un cambio más nuevo
 * (otro dispositivo o pestaña) y se devuelve conflicto en vez de pisarlo.
 */
export async function saveContent(db: Db, userId: string, baseVersion: number | null, content: Content): Promise<SaveResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"business:" + userId}))`);
    const [existing] = await tx.select().from(s.businesses)
      .where(and(eq(s.businesses.ownerId, userId), isNull(s.businesses.deletedAt)));

    // Límite del plan (lo edita el admin): se cuentan solo los productos propios, no los de ejemplo.
    const limit = await productLimit(tx, existing?.planId ?? "gratis");
    const count = realProducts(content).length;
    if (limit !== null && count > limit) return { status: "limit" as const, limit, count };

    let businessId: string;
    let version: number;
    if (!existing) {
      if (baseVersion !== null) return { status: "conflict" as const, version: 0 };
      const [b] = await tx.insert(s.businesses).values({
        ...businessColumns(content), ownerId: userId, slug: placeholderSlug(), contentVersion: 1,
      }).returning({ id: s.businesses.id, v: s.businesses.contentVersion });
      businessId = b!.id; version = b!.v;
    } else {
      if (baseVersion !== existing.contentVersion) return { status: "conflict" as const, version: existing.contentVersion };
      const [b] = await tx.update(s.businesses)
        .set({ ...businessColumns(content), contentVersion: sql`${s.businesses.contentVersion} + 1` })
        .where(eq(s.businesses.id, existing.id)).returning({ v: s.businesses.contentVersion });
      businessId = existing.id; version = b!.v;
    }

    await reconcileCatalog(tx, businessId, content);
    return { status: "ok" as const, version, created: !existing, published: existing?.status === "published" ? existing.slug : null };
  });
}

/** Deja las tablas del catálogo igual al documento, conservando la identidad (uuid) de cada fila por `client_id`. */
async function reconcileCatalog(tx: Tx, businessId: string, c: Content) {
  // Categorías
  const catIds = c.categories.map((x) => x.id);
  const catMap = new Map<string, string>();
  for (const part of chunks(c.categories.map((x, i) => ({ businessId, clientId: x.id, name: x.name, position: i })))) {
    const rows = await tx.insert(s.categories).values(part).onConflictDoUpdate({
      target: [s.categories.businessId, s.categories.clientId],
      set: { name: sql`excluded.name`, position: sql`excluded.position` },
    }).returning({ id: s.categories.id, clientId: s.categories.clientId });
    rows.forEach((r) => catMap.set(r.clientId!, r.id));
  }
  await tx.delete(s.categories).where(and(
    eq(s.categories.businessId, businessId),
    catIds.length ? or(isNull(s.categories.clientId), notInArray(s.categories.clientId, catIds)) : undefined,
  ));

  // Productos
  const prodRows = c.categories.flatMap((cat) => cat.products.map((p, i) => ({
    businessId, clientId: p.id, categoryId: catMap.get(cat.id) ?? null, name: p.name, description: p.description,
    price: num(p.price), comparePrice: num(p.comparePrice), available: p.available, stock: p.stock, position: i, isExample: p.isExample,
  })));
  const prodIds = prodRows.map((p) => p.clientId);
  const prodMap = new Map<string, string>();
  for (const part of chunks(prodRows)) {
    const rows = await tx.insert(s.products).values(part).onConflictDoUpdate({
      target: [s.products.businessId, s.products.clientId],
      set: {
        categoryId: sql`excluded.category_id`, name: sql`excluded.name`, description: sql`excluded.description`,
        price: sql`excluded.price`, comparePrice: sql`excluded.compare_price`, available: sql`excluded.available`,
        stock: sql`excluded.stock`, position: sql`excluded.position`, isExample: sql`excluded.is_example`,
      },
    }).returning({ id: s.products.id, clientId: s.products.clientId });
    rows.forEach((r) => prodMap.set(r.clientId!, r.id));
  }
  // Borrar productos (sus opciones y fotos caen en cascada; los pedidos viejos conservan el nombre y el precio).
  await tx.delete(s.products).where(and(
    eq(s.products.businessId, businessId),
    prodIds.length ? or(isNull(s.products.clientId), notInArray(s.products.clientId, prodIds)) : undefined,
  ));

  // Opciones
  const optRows = c.categories.flatMap((cat) => cat.products.flatMap((p) => p.options.map((o, i) => ({
    businessId, productId: prodMap.get(p.id)!, clientId: o.id, label: o.label, price: num(o.price), soldOut: o.soldOut, position: i,
  }))));
  const optIds = optRows.map((o) => o.clientId);
  for (const part of chunks(optRows)) {
    await tx.insert(s.productOptions).values(part).onConflictDoUpdate({
      target: [s.productOptions.businessId, s.productOptions.clientId],
      set: { productId: sql`excluded.product_id`, label: sql`excluded.label`, price: sql`excluded.price`, soldOut: sql`excluded.sold_out`, position: sql`excluded.position` },
    });
  }
  await tx.delete(s.productOptions).where(and(
    eq(s.productOptions.businessId, businessId),
    optIds.length ? or(isNull(s.productOptions.clientId), notInArray(s.productOptions.clientId, optIds)) : undefined,
  ));
}

const numOrNull = (v: string | null) => (v === null ? null : Number(v));

/** Documento del editor a partir de las filas del servidor (para abrir el editor en otro dispositivo). */
export async function loadContent(db: Db, userId: string) {
  const [b] = await db.select().from(s.businesses).where(and(eq(s.businesses.ownerId, userId), isNull(s.businesses.deletedAt)));
  if (!b) return null;
  const [cats, prods, opts] = await Promise.all([
    db.select().from(s.categories).where(eq(s.categories.businessId, b.id)).orderBy(asc(s.categories.position)),
    db.select().from(s.products).where(eq(s.products.businessId, b.id)).orderBy(asc(s.products.position)),
    db.select().from(s.productOptions).where(and(eq(s.productOptions.businessId, b.id), inArray(s.productOptions.productId, db.select({ id: s.products.id }).from(s.products).where(eq(s.products.businessId, b.id))))).orderBy(asc(s.productOptions.position)),
  ]);

  const settings = (b.settings ?? {}) as Record<string, unknown>;
  const design = (b.design ?? {}) as Record<string, unknown>;
  const hours = Array.isArray(b.hours) && b.hours.length === 7 ? b.hours : defaultHours();
  const cid = (clientId: string | null, id: string) => clientId ?? id;

  const content: Content = {
    industryId: b.industry,
    name: b.name,
    nameIsExample: settings.nameIsExample === true,
    tagline: b.tagline ?? "",
    description: b.description,
    textsAreExample: settings.textsAreExample === true,
    whatsapp: b.whatsapp ?? "",
    instagram: b.instagram ?? "",
    address: b.address ?? "",
    deliveryZone: b.deliveryZone ?? "",
    extraWhatsapps: Array.isArray(settings.extraWhatsapps) ? (settings.extraWhatsapps as Content["extraWhatsapps"]) : [],
    hours: hours as Content["hours"],
    announcement: typeof settings.announcement === "string" ? settings.announcement : "",
    whatsappGreeting: typeof settings.whatsappGreeting === "string" ? settings.whatsappGreeting : "Hola! Quiero hacer este pedido:",
    showQuantities: settings.showQuantities !== false,
    ordersEnabled: settings.ordersEnabled !== false,
    askEventDate: settings.askEventDate === true,
    design: {
      layout: (design.layout as Content["design"]["layout"]) ?? "vidriera",
      theme: (design.theme as Content["design"]["theme"]) ?? "blanco",
      fontPair: (design.fontPair as Content["design"]["fontPair"]) ?? "moderna",
      brandColor: typeof design.brandColor === "string" ? design.brandColor : null,
      buttonShape: (design.buttonShape as Content["design"]["buttonShape"]) ?? "redondeado",
    },
    categories: cats.map((c) => ({
      id: cid(c.clientId, c.id),
      name: c.name,
      products: prods.filter((p) => p.categoryId === c.id).map((p) => ({
        id: cid(p.clientId, p.id), name: p.name, description: p.description, price: numOrNull(p.price), comparePrice: numOrNull(p.comparePrice),
        available: p.available, stock: p.stock, isExample: p.isExample,
        options: opts.filter((o) => o.productId === p.id).map((o) => ({ id: cid(o.clientId, o.id), label: o.label, price: numOrNull(o.price), soldOut: o.soldOut })),
      })),
    })),
  };
  return { business: { id: b.id, slug: b.slug, status: b.status, planId: b.planId, version: b.contentVersion }, content };
}
