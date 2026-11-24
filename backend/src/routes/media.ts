import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config.js";
import type { Db } from "../db/tenant.js";
import * as s from "../db/schema.js";
import type { StorageProvider } from "../storage/index.js";
import { sniff } from "../storage/sniff.js";
import { requireUser } from "../auth/session.js";
import { ImageError, WIDTHS, processImage, variantKey } from "../media/image.js";
import { CONTENT_TYPES, PUBLIC_FILE, mediaUrls } from "../media/urls.js";
import type { SiteChanged } from "../lib/revalidate.js";
import { ownedWhere, pageSelector } from "../lib/activeBusiness.js";

const MAX_COVER = 5;
const DEFAULTS = { photosPerProduct: 4, uploadMb: 10 };
const query = z.object({ productId: z.string().min(1).max(64).optional(), kind: z.enum(["cover", "logo"]).optional() }).refine((q) => !!q.productId !== !!q.kind, "target");

type MediaRow = typeof s.media.$inferSelect;
export const fileKeys = (m: Pick<MediaRow, "path" | "kind">) => (m.kind === "video" ? [m.path] : WIDTHS.map((w) => variantKey(m.path, w)));

/** Fotos y videos del negocio. Se registra dentro del contexto de /me (sesión + chequeo de origen). */
export function mediaRoutes(app: FastifyInstance, db: Db, config: Config, storage: StorageProvider, notify: SiteChanged, perMinute = 60) {
  async function business(req: Parameters<typeof requireUser>[1], reply: Parameters<typeof requireUser>[2]) {
    const user = await requireUser(db, req, reply);
    if (!user) return null;
    const [biz] = await db.select().from(s.businesses).where(ownedWhere(user.id, pageSelector(req)));
    if (!biz) { reply.code(404).send({ error: "no_business" }); return null; }
    return biz;
  }
  const view = (m: MediaRow, productClientId: string | null) => ({ id: m.id, kind: m.kind, productId: productClientId, ...mediaUrls(config, m.path, m.kind) });

  app.get("/me/media", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const rows = await db.select({ m: s.media, clientId: s.products.clientId }).from(s.media)
      .leftJoin(s.products, eq(s.products.id, s.media.productId)).where(eq(s.media.businessId, biz.id)).orderBy(asc(s.media.position), asc(s.media.createdAt));
    reply.header("Cache-Control", "no-store");
    return { media: rows.map(({ m, clientId }) => view(m, clientId)) };
  });

  app.post("/me/media", { config: { rateLimit: { max: perMinute, timeWindow: "1 minute" } } }, async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    const q = query.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_request" });

    const [plan] = await db.select({ limits: s.plans.limits }).from(s.plans).where(eq(s.plans.id, biz.planId));
    const limits = { ...DEFAULTS, ...((plan?.limits ?? {}) as Partial<typeof DEFAULTS>) };

    let productId: string | null = null;
    if (q.data.productId) {
      const [p] = await db.select({ id: s.products.id }).from(s.products).where(and(eq(s.products.businessId, biz.id), eq(s.products.clientId, q.data.productId)));
      if (!p) return reply.code(409).send({ error: "sync_first" }); // el producto todavía no llegó al servidor
      productId = p.id;
    }

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "file_required" });
    const data = await file.toBuffer();
    const maxBytes = limits.uploadMb * 1024 * 1024;
    if (file.file.truncated || data.length > maxBytes) return reply.code(413).send({ error: "file_too_large", maxMb: limits.uploadMb });
    const type = sniff(data);
    const isLogo = q.data.kind === "logo";
    if (!type || type.kind === "document" || (isLogo && type.kind !== "image")) return reply.code(415).send({ error: "unsupported_file" });
    const rowKind = isLogo ? "logo" : type.kind; // el logo es una imagen con kind propio (sin tocar el esquema)

    // Límites por plan: fotos por producto (o 5 de portada) y 1 video por lugar.
    const scope = productId ? eq(s.media.productId, productId) : isNull(s.media.productId);
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.media).where(and(eq(s.media.businessId, biz.id), eq(s.media.kind, rowKind), scope));
    const cap = isLogo ? 1 : type.kind === "video" ? 1 : productId ? limits.photosPerProduct : MAX_COVER;
    if (n >= cap) return reply.code(422).send({ error: isLogo ? "logo_limit" : type.kind === "video" ? "video_limit" : "photo_limit", limit: cap });

    const hash = createHash("sha256").update(data).digest("hex").slice(0, 16);
    const path = type.kind === "video" ? `media/${biz.id}/${hash}.${type.ext}` : `media/${biz.id}/${hash}`;
    if (type.kind === "image") {
      try {
        const { variants } = await processImage(data);
        for (const v of variants) await storage.put(variantKey(path, v.width), v.data);
      } catch (e) {
        if (e instanceof ImageError) return reply.code(422).send({ error: e.code });
        throw e;
      }
    } else {
      await storage.put(path, data);
    }
    const [{ next } = { next: 0 }] = await db.select({ next: sql<number>`coalesce(max(${s.media.position}), -1) + 1` }).from(s.media).where(and(eq(s.media.businessId, biz.id), scope));
    const [row] = await db.insert(s.media).values({ businessId: biz.id, productId, kind: rowKind, path, position: next }).returning();
    if (biz.status === "published") notify(biz.slug);
    return reply.code(201).send(view(row!, q.data.productId ?? null));
  });

  app.delete<{ Params: { id: string } }>("/me/media/:id", async (req, reply) => {
    const biz = await business(req, reply);
    if (!biz) return;
    if (!z.string().uuid().safeParse(req.params.id).success) return reply.code(404).send({ error: "not_found" });
    const [m] = await db.select().from(s.media).where(and(eq(s.media.id, req.params.id), eq(s.media.businessId, biz.id)));
    if (!m) return reply.code(404).send({ error: "not_found" });
    await db.delete(s.media).where(eq(s.media.id, m.id));
    // El mismo archivo puede estar en otra fila (misma foto subida dos veces): solo se borra si nadie más lo usa.
    const [{ others } = { others: 0 }] = await db.select({ others: sql<number>`count(*)::int` }).from(s.media).where(eq(s.media.path, m.path));
    if (others === 0) for (const key of fileKeys(m)) await storage.delete(key).catch(() => undefined);
    if (biz.status === "published") notify(biz.slug);
    return { ok: true };
  });
}

/** Servicio público de archivos. Solo sirve lo generado por MiShowo (nombre validado): los comprobantes de pago jamás salen por acá. */
export function publicMediaRoutes(app: FastifyInstance, storage: StorageProvider) {
  app.get<{ Params: { biz: string; file: string } }>("/uploads/media/:biz/:file", async (req, reply) => {
    const { biz, file } = req.params;
    if (!z.string().uuid().safeParse(biz).success || !PUBLIC_FILE.test(file)) return reply.code(404).send({ error: "not_found" });
    const data = await storage.get(`media/${biz}/${file}`);
    if (!data) return reply.code(404).send({ error: "not_found" });
    const type = CONTENT_TYPES[file.split(".").pop()!]!;
    reply.header("Content-Type", type).header("X-Content-Type-Options", "nosniff").header("Cross-Origin-Resource-Policy", "cross-origin")
      .header("Cache-Control", "public, max-age=31536000, immutable").header("Accept-Ranges", "bytes"); // el nombre lleva el hash: nunca cambia
    const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
      if (start > end || start >= data.length) return reply.code(416).header("Content-Range", `bytes */${data.length}`).send();
      return reply.code(206).header("Content-Range", `bytes ${start}-${end}/${data.length}`).header("Content-Length", end - start + 1).send(data.subarray(start, end + 1));
    }
    return reply.send(data);
  });
}
