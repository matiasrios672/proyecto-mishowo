import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "../db/testdb.js";
import { ORIGIN, RESET, count, makeEnv, type Conn } from "../admin/test-helpers.js";
import { addDays, daySlots, isDate, todayAR, toInstant, weekdayIndex } from "../appointments/slots.js";
import * as s from "../db/schema.js";

let conn: Conn;
let env: ReturnType<typeof makeEnv>;

beforeAll(async () => { conn = await setupTestDb("mishowo_test_appts"); env = makeEnv(conn, { APPOINTMENTS_PER_MINUTE: "10000" }); });
afterAll(async () => { await conn.pool.end(); });
beforeEach(async () => {
  await conn.pool.query(RESET);
  env.mailer.outbox.length = 0;
  await conn.db.insert(s.plans).values([{ id: "gratis", name: "Gratis", priceMonthly: "0", limits: {} }, { id: "basico", name: "Básico", priceMonthly: "1", limits: { appointments: false } }]);
});

// Lunes a sábado 09:00-13:00; domingo cerrado.
const HOURS = Array.from({ length: 7 }, (_, i) => ({ open: i < 6, from: "09:00", to: "13:00" }));
/** Próximo día de la semana dado (lunes=0) a más de 2 días de hoy, para no chocar con la anticipación mínima. */
function futureDate(weekday: number) {
  let d = addDays(todayAR(), 3);
  while (weekdayIndex(d) !== weekday) d = addDays(d, 1);
  return d;
}

async function setup(over: { planId?: string; enabled?: boolean; capacity?: number } = {}, slug = "peluqueria", email = "dueno@test.com") {
  const owner = await env.account(email);
  const [biz] = await conn.db.insert(s.businesses).values({ slug, ownerId: owner.id, name: "Peluquería", status: "published", planId: over.planId ?? "gratis", hours: HOURS }).returning();
  if (over.enabled !== false) await conn.db.insert(s.appointmentSettings).values({ businessId: biz!.id, enabled: true, slotMinutes: 60, capacity: over.capacity ?? 1, services: ["Corte", "Color"] });
  return { owner, biz: biz! };
}
const book = (over: object = {}, slug = "peluqueria") => env.app.inject({
  method: "POST", url: "/public/appointments",
  payload: { slug, date: futureDate(1), time: "10:00", customerName: "Ana Pérez", customerPhone: "11 5555-0000", service: "Corte", ...over },
});
const slotsOf = async (date: string, slug = "peluqueria") => (await env.app.inject({ method: "GET", url: `/public/sites/${slug}/booking/slots?date=${date}` })).json().slots as { time: string; left: number }[];
const patch = (url: string, cookie: string, payload: object) => env.app.inject({ method: "PATCH", url, payload, headers: { cookie, origin: ORIGIN } });

describe("franjas y hora argentina", () => {
  it("genera franjas desde la apertura mientras terminen antes del cierre", () => {
    expect(daySlots(futureDate(0), HOURS, 60)).toEqual(["09:00", "10:00", "11:00", "12:00"]);
    expect(daySlots(futureDate(0), HOURS, 90)).toEqual(["09:00", "10:30"]);
    expect(daySlots(futureDate(6), HOURS, 60)).toEqual([]); // domingo cerrado
    expect(daySlots(futureDate(0), null, 60)).toEqual([]);
    expect(daySlots(futureDate(0), HOURS.map(() => ({ open: true, from: "20:00", to: "02:00" })), 60)).toEqual([]); // cierre pasada la medianoche
  });
  it("las fechas y horas se interpretan en UTC-3, también cerca de la medianoche", () => {
    expect(toInstant("2026-03-10", "23:30").toISOString()).toBe("2026-03-11T02:30:00.000Z");
    expect(todayAR(new Date("2026-03-11T01:30:00Z"))).toBe("2026-03-10"); // a la 01:30 UTC todavía es el día anterior en Argentina
    expect(weekdayIndex("2026-03-09")).toBe(0); // lunes
    expect(weekdayIndex("2026-03-15")).toBe(6); // domingo
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("2026-13-01")).toBe(false);
    expect(isDate("hoy")).toBe(false);
  });
});

describe("configuración del negocio", () => {
  it("se guarda, se valida y se refleja en la config pública", async () => {
    const { owner } = await setup({ enabled: false });
    expect((await env.app.inject({ method: "GET", url: "/public/sites/peluqueria/booking" })).json()).toEqual({ enabled: false });
    const body = { enabled: true, slotMinutes: 45, minNoticeHours: 3, capacity: 2, horizonDays: 14, services: ["Corte", "Barba"] };
    const res = await env.call("PUT", "/me/appointments/settings", owner.cookie, body);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ...body, services: [{ name: "Corte", minutes: null, price: null }, { name: "Barba", minutes: null, price: null }] }); // los servicios viejos (solo nombre) se normalizan
    expect((await env.app.inject({ method: "GET", url: "/public/sites/peluqueria/booking" })).json()).toMatchObject({ enabled: true, slotMinutes: 45, horizonDays: 14, services: [{ name: "Corte" }, { name: "Barba" }] });
    for (const bad of [{ slotMinutes: 5 }, { slotMinutes: 500 }, { capacity: 0 }, { capacity: 21 }, { horizonDays: 0 }, { horizonDays: 91 }, { minNoticeHours: -1 }, { services: Array.from({ length: 21 }, (_, i) => `s${i}`) }, { enabled: "si" }])
      expect((await env.call("PUT", "/me/appointments/settings", owner.cookie, { ...body, ...bad })).statusCode, JSON.stringify(bad)).toBe(400);
    expect((await env.call("PUT", "/me/appointments/settings", owner.cookie, body, "http://evil.example")).statusCode).toBe(403);
    expect((await env.call("GET", "/me/appointments/settings")).statusCode).toBe(401);
  });

  it("el plan puede no permitir turnos (limits.appointments = false en la tabla de planes)", async () => {
    const { owner } = await setup({ planId: "basico", enabled: false });
    const body = { enabled: true, slotMinutes: 30, minNoticeHours: 1, capacity: 1, horizonDays: 7, services: [] };
    expect((await env.call("PUT", "/me/appointments/settings", owner.cookie, body)).json().error).toBe("plan_not_allowed");
    expect((await env.call("GET", "/me/appointments/settings", owner.cookie)).json().allowedByPlan).toBe(false);
    await conn.pool.query(`update plans set limits = '{}' where id = 'basico'`);
    expect((await env.call("PUT", "/me/appointments/settings", owner.cookie, body)).statusCode).toBe(200);
  });
});

describe("reservas públicas", () => {
  it("reserva un turno, lo muestra ocupado y avisa al dueño por email", async () => {
    const { owner } = await setup();
    const date = futureDate(1);
    const res = await book({ date, time: "10:00", notes: "Primera vez" });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ date, time: "10:00", status: "pendiente" });
    expect((await slotsOf(date)).find((x) => x.time === "10:00")).toMatchObject({ time: "10:00", left: 0 });
    expect((await slotsOf(date)).find((x) => x.time === "11:00")).toMatchObject({ time: "11:00", left: 1 });
    await new Promise((r) => setTimeout(r, 100));
    const mail = env.mailer.outbox.find((m) => m.subject.startsWith("Nuevo turno"))!;
    expect(mail.to).toBe(owner.email);
    expect(mail.text).toContain("Ana Pérez");
    expect(mail.text).toContain("/panel/turnos");
    const row = (await conn.pool.query("select starts_at, ends_at from appointments")).rows[0];
    expect(new Date(row.starts_at).toISOString()).toBe(toInstant(date, "10:00").toISOString());
    expect(new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()).toBe(3600_000);
  });

  it("el mismo cupo no se puede reservar dos veces", async () => {
    await setup();
    expect((await book()).statusCode).toBe(201);
    const again = await book({ customerName: "Otra Persona", customerPhone: "11 6666-1111" });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("slot_taken");
    expect(await count(conn, "appointments")).toBe(1);
  });

  it("diez personas reservando el mismo cupo a la vez: una sola se lo lleva", async () => {
    await setup();
    const res = await Promise.all(Array.from({ length: 10 }, (_, i) => book({ customerName: `Cliente ${i}`, customerPhone: `11 5000-00${String(i).padStart(2, "0")}` })));
    expect(res.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(res.filter((r) => r.statusCode === 409)).toHaveLength(9);
    expect(await count(conn, "appointments")).toBe(1);
  });

  it("con cupos múltiples respeta la capacidad también en concurrencia", async () => {
    await setup({ capacity: 3 });
    const res = await Promise.all(Array.from({ length: 8 }, (_, i) => book({ customerName: `Cliente ${i}`, customerPhone: `11 5000-01${String(i).padStart(2, "0")}` })));
    expect(res.filter((r) => r.statusCode === 201)).toHaveLength(3);
    expect(await count(conn, "appointments")).toBe(3);
    expect((await slotsOf(futureDate(1))).find((x) => x.time === "10:00")!.left).toBe(0);
  });

  it("la misma persona no ocupa dos cupos de la misma franja", async () => {
    await setup({ capacity: 3 });
    expect((await book()).statusCode).toBe(201);
    const dup = await book({ customerPhone: "(11) 5555 0000" });
    expect(dup.json().error).toBe("already_booked");
  });

  it("un turno cancelado libera el cupo", async () => {
    const { owner } = await setup();
    const id = (await book()).json().id;
    expect((await patch(`/me/appointments/${id}/status`, owner.cookie, { status: "cancelado" })).statusCode).toBe(200);
    expect((await book({ customerName: "Luis", customerPhone: "11 7777-2222" })).statusCode).toBe(201);
  });

  it("rechaza lo que no se ofrece: franja inexistente, día cerrado, pasado, fuera de horizonte, muy cerca, servicio inválido", async () => {
    await setup();
    const date = futureDate(1);
    for (const [body, err, code] of [
      [{ time: "10:30" }, "slot_unavailable", 422], [{ time: "13:00" }, "slot_unavailable", 422], [{ time: "08:00" }, "slot_unavailable", 422],
      [{ date: futureDate(6) }, "slot_unavailable", 422],
      [{ date: addDays(todayAR(), -1) }, "slot_unavailable", 422],
      [{ date: addDays(todayAR(), 40) }, "slot_unavailable", 422],
      [{ service: "Masaje" }, "invalid_service", 422],
    ] as const) {
      const res = await book(body);
      expect(res.statusCode, JSON.stringify(body)).toBe(code);
      expect(res.json().error, JSON.stringify(body)).toBe(err);
    }
    // anticipación mínima: una franja de dentro de menos de 2 horas no se puede reservar
    await conn.pool.query("update appointment_settings set min_notice_hours = 72");
    expect((await book({ date: addDays(todayAR(), 1), time: "10:00" })).statusCode).toBe(422);
    expect(date).toBeTruthy();
    expect(await count(conn, "appointments")).toBe(0);
  });

  it("valida el cuerpo y no acepta datos raros", async () => {
    await setup();
    for (const bad of [{ customerName: "A" }, { customerName: "" }, { customerPhone: "abc" }, { customerPhone: "123" }, { date: "mañana" }, { time: "25:00" }, { time: "10" }, { notes: "x".repeat(301) }, { slug: "MAL!" }])
      expect((await book(bad)).statusCode, JSON.stringify(bad)).toBe(400);
  });

  it("no reserva si los turnos están desactivados, el plan no los permite o el negocio no está publicado", async () => {
    await setup({ enabled: false }, "apagado", "a@test.com");
    expect((await book({}, "apagado")).json().error).toBe("booking_disabled");
    await setup({ planId: "basico" }, "sinplan", "b@test.com");
    await conn.pool.query(`update appointment_settings set enabled = true`);
    expect((await book({}, "sinplan")).json().error).toBe("booking_disabled");
    expect((await env.app.inject({ method: "GET", url: "/public/sites/sinplan/booking" })).json()).toEqual({ enabled: false });
    const { biz } = await setup({}, "borrador", "c@test.com");
    await conn.pool.query("update businesses set status = 'draft' where id = $1", [biz.id]);
    expect((await book({}, "borrador")).statusCode).toBe(404);
    expect((await slotsOf(futureDate(1), "borrador")) ?? []).toEqual([]);
  });

  it("tiene un límite por IP contra el spam de reservas", async () => {
    const limited = makeEnv(conn, { APPOINTMENTS_PER_MINUTE: "3" });
    await setup();
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await limited.app.inject({ method: "POST", url: "/public/appointments", remoteAddress: "10.5.5.5", payload: { slug: "peluqueria", date: futureDate(1), time: "10:00", customerName: "Spam Bot", customerPhone: `11 5000-000${i}` } })).statusCode);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThanOrEqual(2);
  });
});

describe("panel de turnos", () => {
  it("lista por día con hora local, confirma y cancela con transiciones válidas", async () => {
    const { owner } = await setup();
    const date = futureDate(1);
    const a = (await book({ time: "09:00" })).json();
    await book({ time: "11:00", customerName: "Luis Gómez", customerPhone: "11 7777-2222" });
    const list = (await env.call("GET", `/me/appointments?date=${date}`, owner.cookie)).json().appointments;
    expect(list.map((x: { time: string }) => x.time)).toEqual(["09:00", "11:00"]);
    expect(list[0]).toMatchObject({ date, status: "pendiente", customerName: "Ana Pérez", service: "Corte" });
    expect((await patch(`/me/appointments/${a.id}/status`, owner.cookie, { status: "confirmado" })).json().status).toBe("confirmado");
    expect((await patch(`/me/appointments/${a.id}/status`, owner.cookie, { status: "confirmado" })).statusCode).toBe(409); // ya confirmado
    expect((await patch(`/me/appointments/${a.id}/status`, owner.cookie, { status: "cancelado" })).statusCode).toBe(200);
    expect((await patch(`/me/appointments/${a.id}/status`, owner.cookie, { status: "confirmado" })).statusCode).toBe(409); // cancelado es final
    expect((await env.call("GET", `/me/appointments?date=${date}&status=cancelado`, owner.cookie)).json().appointments).toHaveLength(1);
    expect((await env.call("GET", "/me/appointments", owner.cookie)).json().appointments).toHaveLength(2); // sin fecha: de hoy en adelante
    expect((await env.call("GET", "/me/appointments?date=ayer", owner.cookie)).statusCode).toBe(400);
  });

  it("cada negocio ve y modifica solo sus turnos", async () => {
    const a = await setup({}, "uno", "a@test.com");
    const b = await setup({}, "dos", "b@test.com");
    const id = (await book({}, "uno")).json().id;
    expect((await env.call("GET", "/me/appointments", b.owner.cookie)).json().appointments).toHaveLength(0);
    expect((await patch(`/me/appointments/${id}/status`, b.owner.cookie, { status: "cancelado" })).statusCode).toBe(404);
    expect((await patch(`/me/appointments/${id}/status`, a.owner.cookie, { status: "otro" })).statusCode).toBe(400);
    expect((await patch("/me/appointments/no-uuid/status", a.owner.cookie, { status: "cancelado" })).statusCode).toBe(400);
    expect((await env.call("GET", "/me/appointments")).statusCode).toBe(401);
  });
});

describe("servicios con duración y precio, profesionales y recordatorios", () => {
  const cfg = { enabled: true, slotMinutes: 30, minNoticeHours: 2, capacity: 1, horizonDays: 30,
    services: [{ name: "Corte", minutes: 30, price: 8000 }, { name: "Color", minutes: 90, price: 25000 }], staff: [{ id: "lu111111", name: "Lu" }, { id: "jo222222", name: "Jo" }] };
  async function withCatalog() {
    const { owner, biz } = await setup({ enabled: false });
    await conn.db.insert(s.appointmentSettings).values({ businessId: biz.id, ...cfg });
    return { owner, biz };
  }
  const slotsFor = async (date: string, q = "") => (await env.app.inject({ method: "GET", url: `/public/sites/peluqueria/booking/slots?date=${date}${q}` })).json() as { slots: { time: string; left: number; staff: string[] }[]; minutes: number };

  it("la duración del servicio manda: un color de 90 minutos no entra en la última franja del día", async () => {
    await withCatalog();
    const date = futureDate(1);
    const corte = await slotsFor(date, "&service=Corte");
    const color = await slotsFor(date, "&service=Color");
    expect(corte.minutes).toBe(30);
    expect(corte.slots.map((x) => x.time).at(-1)).toBe("12:30"); // 09:00-13:00, de a 30
    expect(color.slots.map((x) => x.time).at(-1)).toBe("11:30"); // 11:30 + 90 = 13:00
    expect(color.slots.map((x) => x.time)).not.toContain("12:00");
    expect((await slotsFor(date, "&service=Inventado")).slots).toBeUndefined();
  });

  it("con dos profesionales, dos personas reservan la misma hora y la tercera no; «cualquiera» asigna al primero libre", async () => {
    await withCatalog();
    const date = futureDate(2);
    const a = await book({ date, time: "10:00", service: "Corte", customerPhone: "11 1111-1111" });
    expect(a.statusCode).toBe(201);
    expect(a.json().staffName).toBe("Lu");
    const b = await book({ date, time: "10:00", service: "Corte", customerPhone: "11 2222-2222" });
    expect(b.json().staffName).toBe("Jo");
    expect((await book({ date, time: "10:00", service: "Corte", customerPhone: "11 3333-3333" })).json().error).toBe("slot_taken");
    const slot = (await slotsFor(date, "&service=Corte")).slots.find((x) => x.time === "10:00")!;
    expect(slot).toMatchObject({ left: 0, staff: [] });
  });

  it("elegir profesional: ocupa solo a esa persona; un servicio largo bloquea las franjas que pisa", async () => {
    await withCatalog();
    const date = futureDate(3);
    expect((await book({ date, time: "09:00", service: "Color", staffId: "jo222222", customerPhone: "11 1111-1111" })).json().staffName).toBe("Jo");
    const during = (await slotsFor(date, "&service=Corte")).slots;
    expect(during.find((x) => x.time === "09:30")).toMatchObject({ left: 1, staff: ["lu111111"] }); // Jo sigue en el color hasta las 10:30
    expect(during.find((x) => x.time === "10:30")).toMatchObject({ left: 2 });
    expect((await slotsFor(date, "&service=Corte&staff=jo222222")).slots.find((x) => x.time === "09:30")).toMatchObject({ left: 0 });
    expect((await book({ date, time: "09:30", service: "Corte", staffId: "jo222222", customerPhone: "11 2222-2222" })).json().error).toBe("slot_taken");
    expect((await book({ date, time: "09:30", service: "Corte", staffId: "nadie", customerPhone: "11 3333-3333" })).json().error).toBe("invalid_staff");
    const row = (await conn.pool.query("select price, staff_name from appointments order by created_at limit 1")).rows[0];
    expect(Number(row.price)).toBe(25000);
    expect(row.staff_name).toBe("Jo");
  });

  it("dos reservas simultáneas del mismo profesional: una sola gana", async () => {
    await withCatalog();
    const date = futureDate(4);
    const res = await Promise.all([1, 2, 3].map((i) => book({ date, time: "11:00", service: "Corte", staffId: "lu111111", customerPhone: `11 000${i}-0000` })));
    expect(res.map((r) => r.statusCode).sort()).toEqual([201, 409, 409]);
  });

  it("el panel guarda servicios y profesionales, les pone id y no deja repetir servicios", async () => {
    const { owner } = await setup({ enabled: false });
    const body = { enabled: true, slotMinutes: 30, minNoticeHours: 2, capacity: 1, horizonDays: 30, services: [{ name: "Corte", minutes: 30, price: 8000 }], staff: [{ name: "Lu" }] };
    const res = await env.call("PUT", "/me/appointments/settings", owner.cookie, body);
    expect(res.statusCode).toBe(200);
    expect(res.json().staff[0]).toMatchObject({ name: "Lu" });
    expect(res.json().staff[0].id).toMatch(/^[a-z0-9]{8}$/);
    expect((await env.call("PUT", "/me/appointments/settings", owner.cookie, { ...body, services: [{ name: "Corte" }, { name: "corte" }] })).json().error).toBe("duplicate_service");
    for (const bad of [{ services: [{ name: "X", minutes: 2 }] }, { services: [{ name: "X", price: -5 }] }, { staff: Array(11).fill({ name: "p" }) }])
      expect((await env.call("PUT", "/me/appointments/settings", owner.cookie, { ...body, ...bad })).statusCode, JSON.stringify(bad)).toBe(400);
  });

  it("si el cliente deja su email recibe acuse, confirmación y cancelación; sin email no sale nada", async () => {
    const { owner } = await withCatalog();
    const date = futureDate(5);
    env.mailer.outbox.length = 0;
    const r = await book({ date, time: "10:00", service: "Corte", customerEmail: "Ana@Test.com", customerPhone: "11 1111-1111" });
    expect(r.statusCode).toBe(201);
    await new Promise((x) => setTimeout(x, 150));
    const got = env.mailer.outbox.find((m) => m.to === "ana@test.com")!;
    expect(got.subject).toBe("Recibimos tu reserva en Peluquería");
    expect(got.text).toContain("10:00");
    expect(got.text).toContain("Corte");
    expect((await patch(`/me/appointments/${r.json().id}/status`, owner.cookie, { status: "confirmado" })).statusCode).toBe(200);
    await new Promise((x) => setTimeout(x, 150));
    expect(env.mailer.outbox.map((m) => m.subject)).toContain("Tu turno en Peluquería está confirmado");
    expect((await patch(`/me/appointments/${r.json().id}/status`, owner.cookie, { status: "cancelado" })).statusCode).toBe(200);
    await new Promise((x) => setTimeout(x, 150));
    expect(env.mailer.outbox.map((m) => m.subject)).toContain("Se canceló tu turno en Peluquería");
    env.mailer.outbox.length = 0;
    expect((await book({ date, time: "11:00", service: "Corte", customerPhone: "11 5555-5555" })).statusCode).toBe(201); // sin email
    await new Promise((x) => setTimeout(x, 150));
    expect(env.mailer.outbox.filter((m) => !m.subject.startsWith("Nuevo turno"))).toHaveLength(0);
    expect((await book({ date, time: "12:00", service: "Corte", customerEmail: "no-es-un-email", customerPhone: "11 6666-6666" })).statusCode).toBe(400);
  });

  it("el recordatorio sale una vez, 24 horas antes, solo con email y para turnos vigentes", async () => {
    const { biz } = await withCatalog();
    const soon = new Date(Date.now() + 10 * 3600_000), far = new Date(Date.now() + 40 * 3600_000), past = new Date(Date.now() - 3600_000);
    const mk = (at: Date, over: object = {}) => conn.db.insert(s.appointments).values({ businessId: biz.id, startsAt: at, endsAt: new Date(at.getTime() + 1_800_000), customerName: "Ana", customerPhone: "111111", customerEmail: "ana@test.com", service: "Corte", ...over });
    await mk(soon); await mk(soon, { customerEmail: null }); await mk(soon, { status: "cancelado" }); await mk(far); await mk(past);
    env.mailer.outbox.length = 0;
    const { remindAppointments } = await import("../appointments/notify.js");
    const [a, b] = await Promise.all([remindAppointments(conn.db, env.mailer), remindAppointments(conn.db, env.mailer)]);
    expect(a + b).toBe(1);
    expect(env.mailer.outbox).toHaveLength(1);
    expect(env.mailer.outbox[0]).toMatchObject({ to: "ana@test.com", subject: "Mañana tenés turno en Peluquería" });
    expect(await remindAppointments(conn.db, env.mailer)).toBe(0); // no se repite
  });
});
