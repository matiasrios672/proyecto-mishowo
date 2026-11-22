import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { setupTestDb } from "../db/testdb.js";
import { createMemoryMailer } from "../lib/mailer.js";

const ORIGIN = "http://localhost:3000";
let conn: Awaited<ReturnType<typeof setupTestDb>>;
let app: ReturnType<typeof buildApp>;
let mailer: ReturnType<typeof createMemoryMailer>;

beforeAll(async () => {
  conn = await setupTestDb("mishowo_test_auth");
  mailer = createMemoryMailer();
  app = buildApp(loadConfig({ NODE_ENV: "test", AUTH_PER_MINUTE: "10000" }), conn.check, conn.db, { mailer });
});
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query("truncate table auth_tokens, sessions, users restart identity cascade");
  mailer.outbox.length = 0;
});

const post = (url: string, payload: object, extra: { cookie?: string; origin?: string | null } = {}) =>
  app.inject({
    method: "POST", url, payload,
    headers: {
      ...(extra.origin === null ? {} : { origin: extra.origin ?? ORIGIN }),
      ...(extra.cookie ? { cookie: extra.cookie } : {}),
    },
  });
const sessionCookie = (res: { cookies: { name: string; value: string }[] }) => {
  const c = res.cookies.find((x) => x.name === "ms_session");
  return c ? `ms_session=${c.value}` : undefined;
};
const tokenFrom = (i = -1) => {
  const mail = mailer.outbox.at(i)!;
  return decodeURIComponent(mail.text.match(/token=([^\s&]+)/)![1]!);
};
const me = (cookie?: string) => app.inject({ method: "GET", url: "/auth/me", headers: cookie ? { cookie } : {} });
const register = (over: object = {}) => post("/auth/register", { email: "Ana@Test.com", password: "claveSegura1", name: "Ana", ...over });

describe("registro", () => {
  it("crea la cuenta, inicia sesión con cookie segura y manda el mail de verificación", async () => {
    const res = await register();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toMatchObject({ email: "ana@test.com", name: "Ana", emailVerified: false, role: "user" });
    expect(JSON.stringify(body)).not.toMatch(/password|hash/i);

    const c = res.cookies.find((x) => x.name === "ms_session")!;
    expect(c).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    expect(c.value.length).toBeGreaterThan(30);

    expect(mailer.outbox).toHaveLength(1);
    expect(mailer.outbox[0]).toMatchObject({ to: "ana@test.com" });
    expect(mailer.outbox[0]!.text).toContain("/verificar?token=");
  });

  it("guarda la contraseña con argon2id y la sesión solo como hash", async () => {
    const res = await register();
    const row = (await conn.pool.query("select password_hash from users")).rows[0];
    expect(row.password_hash).toMatch(/^\$argon2id\$/);
    expect(row.password_hash).not.toContain("claveSegura1");
    const raw = res.cookies.find((x) => x.name === "ms_session")!.value;
    const ids = (await conn.pool.query("select id from sessions")).rows.map((r) => r.id);
    expect(ids).toHaveLength(1);
    expect(ids).not.toContain(raw); // en la base no está el token real
  });

  it("rechaza email repetido (sin distinguir mayúsculas)", async () => {
    await register();
    const dup = await register({ email: "ANA@test.com" });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error).toBe("email_taken");
    expect((await conn.pool.query("select count(*)::int as n from users")).rows[0].n).toBe(1);
  });

  it("valida email y contraseña", async () => {
    expect((await register({ email: "no-es-mail" })).statusCode).toBe(400);
    const short = await register({ password: "corta" });
    expect(short.statusCode).toBe(400);
    expect(short.json().error).toBe("password_too_short");
    expect((await register({ password: "x".repeat(129) })).statusCode).toBe(400);
    expect((await register({ email: "alguien@test.com", password: "ALGUIEN@test.com" })).json().error).toBe("password_is_email");
  });

  it("registrarse no falla si el servidor de mail está caído", async () => {
    const broken = buildApp(loadConfig({ NODE_ENV: "test", AUTH_PER_MINUTE: "10000" }), conn.check, conn.db, {
      mailer: { send: async () => { throw new Error("SMTP caído"); } },
    });
    const res = await broken.inject({ method: "POST", url: "/auth/register", headers: { origin: ORIGIN }, payload: { email: "x@test.com", password: "claveSegura1" } });
    expect(res.statusCode).toBe(201);
  });
});

describe("login, sesión y logout", () => {
  it("entra con la contraseña correcta", async () => {
    await register();
    const res = await post("/auth/login", { email: "ana@test.com", password: "claveSegura1" });
    expect(res.statusCode).toBe(200);
    const cookie = sessionCookie(res)!;
    expect((await me(cookie)).json().user.email).toBe("ana@test.com");
    expect((await conn.pool.query("select last_login_at from users")).rows[0].last_login_at).not.toBeNull();
  });

  it("no revela si el email existe: mismo error con contraseña mala o cuenta inexistente", async () => {
    await register();
    const bad = await post("/auth/login", { email: "ana@test.com", password: "incorrecta1" });
    const none = await post("/auth/login", { email: "nadie@test.com", password: "incorrecta1" });
    expect(bad.statusCode).toBe(401);
    expect(none.statusCode).toBe(401);
    expect(bad.json()).toEqual(none.json());
    expect(sessionCookie(bad)).toBeUndefined();
  });

  it("una cuenta sin contraseña (creada por enlace mágico) no entra con contraseña", async () => {
    await conn.pool.query("insert into users (email) values ('magica@test.com')");
    expect((await post("/auth/login", { email: "magica@test.com", password: "loQueSea123" })).statusCode).toBe(401);
  });

  it("un usuario bloqueado no puede entrar ni usar una sesión que ya tenía", async () => {
    const reg = await register();
    const cookie = sessionCookie(reg)!;
    await conn.pool.query("update users set blocked_at = now()");
    expect((await post("/auth/login", { email: "ana@test.com", password: "claveSegura1" })).statusCode).toBe(403);
    expect((await me(cookie)).json().user).toBeNull();
  });

  it("/auth/me devuelve null sin sesión, con basura o con sesión vencida", async () => {
    expect((await me()).json()).toEqual({ user: null });
    expect((await me("ms_session=inventada")).json()).toEqual({ user: null });
    const cookie = sessionCookie(await register())!;
    await conn.pool.query("update sessions set expires_at = now() - interval '1 minute'");
    expect((await me(cookie)).json().user).toBeNull();
  });

  it("logout cierra la sesión en el servidor, no solo en el navegador", async () => {
    const cookie = sessionCookie(await register())!;
    const out = await post("/auth/logout", {}, { cookie });
    expect(out.statusCode).toBe(200);
    expect((await me(cookie)).json().user).toBeNull(); // el mismo token ya no sirve
    expect((await conn.pool.query("select count(*)::int as n from sessions")).rows[0].n).toBe(0);
  });
});

describe("verificación de email", () => {
  it("el enlace verifica la cuenta y sirve una sola vez", async () => {
    const cookie = sessionCookie(await register())!;
    const t = tokenFrom();
    expect((await post("/auth/verify", { token: t })).statusCode).toBe(200);
    expect((await me(cookie)).json().user.emailVerified).toBe(true);
    const again = await post("/auth/verify", { token: t });
    expect(again.statusCode).toBe(400);
    expect(again.json().error).toBe("invalid_token");
  });

  it("rechaza tokens vencidos, inventados o de otro tipo", async () => {
    await register();
    const t = tokenFrom();
    await conn.pool.query("update auth_tokens set expires_at = now() - interval '1 second'");
    expect((await post("/auth/verify", { token: t })).statusCode).toBe(400);
    expect((await post("/auth/verify", { token: "a".repeat(43) })).statusCode).toBe(400);
    expect((await post("/auth/verify", { token: "corto" })).statusCode).toBe(400);
    await post("/auth/forgot", { email: "ana@test.com" });
    expect((await post("/auth/verify", { token: tokenFrom() })).statusCode).toBe(400); // un token de reset no verifica
  });

  it("el token no se guarda en claro", async () => {
    await register();
    const t = tokenFrom();
    expect((await conn.pool.query("select token_hash from auth_tokens")).rows[0].token_hash).not.toBe(t);
  });

  it("reenviar requiere sesión e invalida el enlace anterior", async () => {
    const cookie = sessionCookie(await register())!;
    const first = tokenFrom();
    expect((await post("/auth/resend-verification", {})).statusCode).toBe(401);
    expect((await post("/auth/resend-verification", {}, { cookie })).statusCode).toBe(200);
    expect(mailer.outbox).toHaveLength(2);
    expect((await post("/auth/verify", { token: first })).statusCode).toBe(400); // el viejo quedó anulado
    expect((await post("/auth/verify", { token: tokenFrom() })).statusCode).toBe(200);
    expect((await post("/auth/resend-verification", {}, { cookie })).json().alreadyVerified).toBe(true);
  });
});

describe("restablecer contraseña", () => {
  it("responde igual exista o no la cuenta, y solo manda mail si existe", async () => {
    await register();
    mailer.outbox.length = 0;
    const real = await post("/auth/forgot", { email: "ana@test.com" });
    const fake = await post("/auth/forgot", { email: "nadie@test.com" });
    expect(real.statusCode).toBe(200);
    expect(fake.json()).toEqual(real.json());
    expect(mailer.outbox).toHaveLength(1);
    expect(mailer.outbox[0]!.to).toBe("ana@test.com");
  });

  it("cambia la contraseña, cierra todas las sesiones y el enlace sirve una sola vez", async () => {
    const cookie = sessionCookie(await register())!;
    await post("/auth/forgot", { email: "ana@test.com" });
    const t = tokenFrom();
    expect((await post("/auth/reset", { token: t, password: "nuevaClave99" })).statusCode).toBe(200);

    expect((await me(cookie)).json().user).toBeNull(); // la sesión vieja murió
    expect((await post("/auth/login", { email: "ana@test.com", password: "claveSegura1" })).statusCode).toBe(401);
    expect((await post("/auth/login", { email: "ana@test.com", password: "nuevaClave99" })).statusCode).toBe(200);
    expect((await post("/auth/reset", { token: t, password: "otraClave123" })).statusCode).toBe(400);
  });

  it("valida la contraseña nueva y no gasta el token si es inválida", async () => {
    await register();
    await post("/auth/forgot", { email: "ana@test.com" });
    const t = tokenFrom();
    const bad = await post("/auth/reset", { token: t, password: "corta" });
    expect(bad.json().error).toBe("password_too_short");
    expect((await post("/auth/reset", { token: t, password: "claveLarga123" })).statusCode).toBe(200);
  });

  it("dos usos simultáneos del mismo enlace: solo uno gana", async () => {
    await register();
    await post("/auth/forgot", { email: "ana@test.com" });
    const t = tokenFrom();
    const res = await Promise.all([post("/auth/reset", { token: t, password: "claveUno1234" }), post("/auth/reset", { token: t, password: "claveDos1234" })]);
    expect(res.map((r) => r.statusCode).sort()).toEqual([200, 400]);
  });
});

describe("enlace mágico", () => {
  it("crea la cuenta verificada la primera vez y deja entrar", async () => {
    expect((await post("/auth/magic", { email: "Nuevo@Test.com" })).statusCode).toBe(200);
    expect(mailer.outbox[0]).toMatchObject({ to: "nuevo@test.com" });
    expect((await conn.pool.query("select count(*)::int as n from users")).rows[0].n).toBe(0); // todavía no hay cuenta
    const res = await post("/auth/magic/consume", { token: tokenFrom() });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ email: "nuevo@test.com", emailVerified: true });
    expect((await me(sessionCookie(res))).json().user.email).toBe("nuevo@test.com");
  });

  it("usa la cuenta existente en vez de duplicarla y la marca verificada", async () => {
    await register();
    await post("/auth/magic", { email: "ana@test.com" });
    const res = await post("/auth/magic/consume", { token: tokenFrom() });
    expect(res.json().user.emailVerified).toBe(true);
    expect((await conn.pool.query("select count(*)::int as n from users")).rows[0].n).toBe(1);
  });

  it("vale una sola vez, vence a los 15 minutos y el nuevo anula el anterior", async () => {
    await post("/auth/magic", { email: "a@test.com" });
    const first = tokenFrom();
    await post("/auth/magic", { email: "a@test.com" });
    expect((await post("/auth/magic/consume", { token: first })).statusCode).toBe(400);
    const second = tokenFrom();
    expect((await post("/auth/magic/consume", { token: second })).statusCode).toBe(200);
    expect((await post("/auth/magic/consume", { token: second })).statusCode).toBe(400);

    await post("/auth/magic", { email: "b@test.com" });
    const t = tokenFrom();
    await conn.pool.query("update auth_tokens set expires_at = now() - interval '1 second' where email = 'b@test.com'");
    expect((await post("/auth/magic/consume", { token: t })).statusCode).toBe(400);
  });

  it("un usuario bloqueado no recibe enlace ni entra", async () => {
    await register();
    await conn.pool.query("update users set blocked_at = now()");
    mailer.outbox.length = 0;
    await post("/auth/magic", { email: "ana@test.com" });
    expect(mailer.outbox).toHaveLength(0);
  });
});

describe("protección CSRF", () => {
  it("rechaza POST sin Origin, con Origin ajeno o desde el subdominio de un negocio", async () => {
    for (const origin of [null, "https://evil.com", "http://lupe.localhost:3000", "null"]) {
      const res = await post("/auth/login", { email: "ana@test.com", password: "claveSegura1" }, { origin });
      expect(res.statusCode, String(origin)).toBe(403);
      expect(res.json().error).toBe("bad_origin");
    }
  });
  it("las lecturas no exigen Origin", async () => {
    expect((await me()).statusCode).toBe(200);
  });
  it("no afecta a las rutas públicas (el pedido sale desde el subdominio del negocio)", async () => {
    const res = await app.inject({
      method: "POST", url: "/public/orders", headers: { origin: "http://lupe.localhost:3000" },
      payload: { slug: "no-existe", items: [{ productId: "00000000-0000-4000-8000-000000000000", quantity: 1 }] },
    });
    expect(res.statusCode).toBe(404); // llegó a la lógica del pedido, no fue frenado por el chequeo de origen
  });
});

describe("límite de intentos", () => {
  it("frena la fuerza bruta sobre el login", async () => {
    const limited = buildApp(loadConfig({ NODE_ENV: "test", AUTH_PER_MINUTE: "5" }), conn.check, conn.db, { mailer });
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push((await limited.inject({ method: "POST", url: "/auth/login", headers: { origin: ORIGIN }, payload: { email: "x@test.com", password: "claveMala123" } })).statusCode);
    }
    expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
    expect(codes.slice(5).every((c) => c === 429)).toBe(true);
  });
});
