import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { setupTestDb } from "../db/testdb.js";
import { ORIGIN, RESET, count, makeEnv, type Conn } from "../admin/test-helpers.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;

beforeAll(async () => { conn = await setupTestDb("mishowo_test_media"); env = makeEnv(conn, { UPLOADS_PER_MINUTE: "10000" }); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  await conn.db.insert(s.plans).values([
    { id: "gratis", name: "Gratis", priceMonthly: "0", limits: { products: 20, photosPerProduct: 2, uploadMb: 1 } },
    { id: "pro", name: "Pro", priceMonthly: "19900", limits: { photosPerProduct: 6, uploadMb: 10 } },
  ]);
  env.files.clear(); env.notified.length = 0;
});

function multipart(data: Buffer, filename: string, type: string) {
  const boundary = "----mishowoMedia" + Math.random().toString(16).slice(2);
  const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`), data, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  return { body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}
const send = (url: string, cookie: string, data: Buffer, filename = "foto.jpg", type = "image/jpeg") => {
  const m = multipart(data, filename, type);
  return env.app.inject({ method: "POST", url, payload: m.body, headers: { ...m.headers, cookie, origin: ORIGIN } });
};
const photo = (w = 1200, h = 900, color = "#c0392b") => sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg().toBuffer();
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(200, 7)]);

async function setup(planId = "gratis") {
  const owner = await env.account("dueno@test.com");
  const [biz] = await conn.db.insert(s.businesses).values({ slug: "lupe", ownerId: owner.id, name: "Lupe", status: "published", planId }).returning();
  const [prod] = await conn.db.insert(s.products).values({ businessId: biz!.id, clientId: "p1", name: "Empanada", position: 0 }).returning();
  return { owner, biz: biz!, prod: prod! };
}

describe("subida de fotos", () => {
  it("convierte a WebP en 3 tamaños, nunca agranda y devuelve srcset", async () => {
    const { owner, biz } = await setup();
    const res = await send("/me/media?productId=p1", owner.cookie, await photo(1200, 900));
    expect(res.statusCode).toBe(201);
    const j = res.json();
    expect(j.srcSet).toMatch(/-400\.webp 400w, .*-800\.webp 800w, .*-1600\.webp 1600w/);
    const keys = [...env.files.keys()].filter((k) => k.startsWith(`media/${biz.id}/`));
    expect(keys).toHaveLength(3);
    const w = async (suffix: string) => (await sharp(env.files.get(keys.find((k) => k.endsWith(suffix))!)!).metadata());
    expect((await w("-400.webp")).width).toBe(400);
    expect((await w("-800.webp")).width).toBe(800);
    expect((await w("-1600.webp")).width).toBe(1200); // la original era de 1200: no se agranda
    expect((await w("-800.webp")).format).toBe("webp");
    expect(env.notified).toContain("lupe");
  });

  it("borra los metadatos: la ubicación GPS del celular no llega al sitio público", async () => {
    const { owner, biz } = await setup();
    const withExif = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#222" } })
      .withExif({ IFD0: { Copyright: "SECRETO-GPS-123" } }).jpeg().toBuffer();
    expect(withExif.toString("latin1")).toContain("SECRETO-GPS-123"); // el test de verdad tiene metadatos
    await send("/me/media?productId=p1", owner.cookie, withExif);
    for (const [k, v] of env.files) if (k.startsWith(`media/${biz.id}/`)) {
      expect(v.toString("latin1")).not.toContain("SECRETO-GPS-123");
      expect((await sharp(v).metadata()).exif).toBeUndefined();
    }
  });

  it("aplica la orientación del EXIF (foto vertical sacada de costado)", async () => {
    const { owner, biz } = await setup();
    const sideways = await sharp({ create: { width: 800, height: 400, channels: 3, background: "#0a0" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    await send("/me/media?productId=p1", owner.cookie, sideways);
    const k = [...env.files.keys()].find((x) => x.startsWith(`media/${biz.id}/`) && x.endsWith("-800.webp"))!;
    const meta = await sharp(env.files.get(k)!).metadata();
    expect(meta.height!).toBeGreaterThan(meta.width!);
  });

  it("rechaza lo que no es imagen o video real, aunque venga con extensión y tipo de foto", async () => {
    const { owner, biz } = await setup();
    for (const bad of [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), Buffer.from("MZ" + "x".repeat(300)), Buffer.from("%PDF-1.4 " + "x".repeat(100)), Buffer.from("<html>hola</html>".repeat(20))]) {
      const res = await send("/me/media?productId=p1", owner.cookie, bad, "foto.png", "image/png");
      expect(res.statusCode).toBe(415);
    }
    expect(await count(conn, "media", `business_id = '${biz.id}'`)).toBe(0);
    expect(env.files.size).toBe(0);
  });

  it("una imagen corrupta (cabecera válida, datos rotos) es 422 y no deja archivos a medias", async () => {
    const { owner } = await setup();
    const jpeg = await photo();
    const res = await send("/me/media?productId=p1", owner.cookie, Buffer.concat([jpeg.subarray(0, 60), Buffer.alloc(500, 0xab)]));
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("invalid_image");
    expect(env.files.size).toBe(0);
  });

  it("respeta el límite de MB y de fotos por producto de SU plan", async () => {
    const { owner } = await setup("gratis");
    const big = await sharp({ create: { width: 3000, height: 3000, channels: 3, background: "#fff" } }).png({ compressionLevel: 0 }).toBuffer();
    expect(big.length).toBeGreaterThan(1024 * 1024);
    expect((await send("/me/media?productId=p1", owner.cookie, big, "g.png", "image/png")).statusCode).toBe(413);
    expect((await send("/me/media?productId=p1", owner.cookie, await photo(500, 500, "#111"))).statusCode).toBe(201);
    expect((await send("/me/media?productId=p1", owner.cookie, await photo(500, 500, "#222"))).statusCode).toBe(201);
    const third = await send("/me/media?productId=p1", owner.cookie, await photo(500, 500, "#333"));
    expect(third.statusCode).toBe(422);
    expect(third.json()).toMatchObject({ error: "photo_limit", limit: 2 });
  });

  it("el límite sale de la tabla de planes: subirlo desde el admin habilita más fotos", async () => {
    const { owner } = await setup("gratis");
    await conn.pool.query(`update plans set limits = '{"photosPerProduct":3,"uploadMb":1}' where id = 'gratis'`);
    for (const c of ["#111", "#222", "#333"]) expect((await send("/me/media?productId=p1", owner.cookie, await photo(500, 500, c))).statusCode).toBe(201);
    expect((await send("/me/media?productId=p1", owner.cookie, await photo(500, 500, "#444"))).statusCode).toBe(422);
  });

  it("acepta un video (1 por negocio) y lo guarda tal cual", async () => {
    const { owner } = await setup("pro");
    const res = await send("/me/media?kind=cover", owner.cookie, MP4, "v.mp4", "video/mp4");
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ kind: "video", srcSet: null });
    expect((await send("/me/media?kind=cover", owner.cookie, Buffer.concat([MP4, Buffer.from("2")]), "v2.mp4", "video/mp4")).json().error).toBe("video_limit");
  });

  it("la portada admite hasta 5 fotos", async () => {
    const { owner } = await setup("pro");
    for (let i = 0; i < 5; i++) expect((await send("/me/media?kind=cover", owner.cookie, await photo(300 + i, 300, `#${i}${i}${i}`))).statusCode).toBe(201);
    expect((await send("/me/media?kind=cover", owner.cookie, await photo(399, 300, "#abc"))).json().error).toBe("photo_limit");
  });

  it("pide destino válido, un producto ya sincronizado y sesión", async () => {
    const { owner } = await setup();
    const img = await photo(300, 300);
    expect((await send("/me/media", owner.cookie, img)).statusCode).toBe(400);
    expect((await send("/me/media?productId=p1&kind=cover", owner.cookie, img)).statusCode).toBe(400);
    expect((await send("/me/media?productId=no-existe", owner.cookie, img)).json().error).toBe("sync_first");
    expect((await send("/me/media?kind=cover", "", img)).statusCode).toBe(401);
    const m = multipart(img, "f.jpg", "image/jpeg");
    expect((await env.app.inject({ method: "POST", url: "/me/media?kind=cover", payload: m.body, headers: { ...m.headers, cookie: owner.cookie, origin: "http://evil.example" } })).statusCode).toBe(403);
  });

  it("no se puede subir a un producto de otro negocio", async () => {
    const { owner } = await setup();
    const other = await env.account("otro@test.com");
    const [b2] = await conn.db.insert(s.businesses).values({ slug: "otro", ownerId: other.id, name: "Otro" }).returning();
    await conn.db.insert(s.products).values({ businessId: b2!.id, clientId: "ajeno", name: "X" });
    expect((await send("/me/media?productId=ajeno", owner.cookie, await photo(300, 300))).json().error).toBe("sync_first");
  });
});

describe("listar, borrar y servir", () => {
  it("lista solo lo propio y borrar elimina los archivos (si nadie más los usa)", async () => {
    const { owner } = await setup();
    const other = await env.account("otro@test.com");
    await conn.db.insert(s.businesses).values({ slug: "otro", ownerId: other.id, name: "Otro" });
    const up = (await send("/me/media?productId=p1", owner.cookie, await photo())).json();
    await send("/me/media?kind=cover", other.cookie, await photo(400, 400, "#00f"));
    const mine = (await env.call("GET", "/me/media", owner.cookie)).json().media;
    expect(mine).toHaveLength(1);
    expect(mine[0].productId).toBe("p1");
    // el otro usuario no puede borrar la foto ajena
    expect((await env.call("DELETE", `/me/media/${up.id}`, other.cookie)).statusCode).toBe(404);
    expect(env.files.size).toBeGreaterThan(3);
    const before = env.files.size;
    expect((await env.call("DELETE", `/me/media/${up.id}`, owner.cookie)).statusCode).toBe(200);
    expect(env.files.size).toBe(before - 3);
    expect((await env.call("DELETE", `/me/media/${up.id}`, owner.cookie)).statusCode).toBe(404);
    expect((await env.call("DELETE", "/me/media/no-uuid", owner.cookie)).statusCode).toBe(404);
  });

  it("la misma foto en dos lugares comparte archivos: borrar una no rompe la otra", async () => {
    const { owner } = await setup("pro");
    const img = await photo(500, 500, "#123456");
    const a = (await send("/me/media?productId=p1", owner.cookie, img)).json();
    const b = (await send("/me/media?kind=cover", owner.cookie, img)).json();
    await env.call("DELETE", `/me/media/${a.id}`, owner.cookie);
    expect(env.files.size).toBe(3);
    await env.call("DELETE", `/me/media/${b.id}`, owner.cookie);
    expect(env.files.size).toBe(0);
  });

  it("sirve los archivos con caché larga y nosniff, y soporta Range para video", async () => {
    const { owner, biz } = await setup("pro");
    const up = (await send("/me/media?productId=p1", owner.cookie, await photo(500, 500))).json();
    const path = new URL(up.src).pathname;
    const res = await env.app.inject({ method: "GET", url: path });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/webp");
    expect(res.headers["cache-control"]).toContain("immutable");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");

    const v = (await send("/me/media?kind=cover", owner.cookie, MP4, "v.mp4", "video/mp4")).json();
    const vp = new URL(v.src).pathname;
    expect(vp).toContain(biz.id);
    const part = await env.app.inject({ method: "GET", url: vp, headers: { range: "bytes=0-9" } });
    expect(part.statusCode).toBe(206);
    expect(part.headers["content-range"]).toBe(`bytes 0-9/${MP4.length}`);
    expect(part.rawPayload.length).toBe(10);
    expect((await env.app.inject({ method: "GET", url: vp, headers: { range: "bytes=99999-" } })).statusCode).toBe(416);
  });

  it("solo sirve lo generado por MiShowo: ni comprobantes de pago, ni rutas inventadas, ni path traversal", async () => {
    const { biz } = await setup();
    env.files.set("receipts/secreto.png", Buffer.from("secreto"));
    env.files.set(`media/${biz.id}/secreto.html`, Buffer.from("<script>"));
    env.files.set(`media/${biz.id}/aaaaaaaaaaaaaaaa.png`, Buffer.from("x"));
    for (const url of ["/uploads/receipts/secreto.png", `/uploads/media/${biz.id}/secreto.html`, `/uploads/media/${biz.id}/aaaaaaaaaaaaaaaa.png`, `/uploads/media/${biz.id}/..%2F..%2Freceipts%2Fsecreto.png`, "/uploads/media/no-uuid/aaaaaaaaaaaaaaaa-800.webp", `/uploads/media/${biz.id}/aaaaaaaaaaaaaaaa-800.webp`])
      expect((await env.app.inject({ method: "GET", url })).statusCode, url).toBe(404);
  });
});

describe("sitio público", () => {
  it("devuelve la portada, la foto principal de cada producto y el video; sin fotos, null", async () => {
    const { owner } = await setup("pro");
    await conn.db.insert(s.products).values({ businessId: (await conn.pool.query("select id from businesses")).rows[0].id, clientId: "p2", name: "Sin foto", position: 1 });
    await send("/me/media?productId=p1", owner.cookie, await photo(600, 600, "#a00"));
    await send("/me/media?productId=p1", owner.cookie, await photo(600, 600, "#0a0"));
    await send("/me/media?kind=cover", owner.cookie, await photo(900, 600, "#00a"));
    await send("/me/media?kind=cover", owner.cookie, MP4, "v.mp4", "video/mp4");
    const site = (await env.app.inject({ method: "GET", url: "/public/sites/lupe" })).json();
    expect(site.cover.src).toMatch(/\/uploads\/media\/.*-800\.webp$/);
    expect(site.video).toMatch(/\.mp4$/);
    const byName = Object.fromEntries(site.products.map((p: { name: string }) => [p.name, p]));
    expect(byName["Empanada"].image.srcSet).toContain("400w");
    expect(byName["Sin foto"].image).toBeNull();
  });
});
