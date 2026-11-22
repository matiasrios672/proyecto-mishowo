import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncEngine, type PushResult, type SyncState } from "./syncEngine";

type Doc = { n: number };

function setup(initialVersion: number | null = 1, results: (PushResult | "hang")[] = []) {
  const calls: { doc: Doc; base: number | null }[] = [];
  const states: SyncState[] = [];
  const synced: number[] = [];
  const resolvers: ((r: PushResult) => void)[] = [];
  let version = initialVersion ?? 0;
  const push = vi.fn(async (doc: Doc, base: number | null): Promise<PushResult> => {
    calls.push({ doc, base });
    const next = results.shift();
    if (next === "hang") return new Promise<PushResult>((res) => resolvers.push(res));
    if (next) return next;
    version += 1;
    return { ok: true, version };
  });
  const engine = createSyncEngine<Doc>({ push, onState: (s) => states.push(s), onSynced: (v) => synced.push(v), debounceMs: 800, retryBaseMs: 5000, retryMaxMs: 60_000 }, initialVersion);
  return { engine, push, calls, states, synced, resolvers, kinds: () => states.map((s) => s.kind) };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("syncEngine", () => {
  it("junta una ráfaga de cambios en un solo guardado con el último contenido", async () => {
    const t = setup();
    t.engine.schedule({ n: 1 });
    await vi.advanceTimersByTimeAsync(300);
    t.engine.schedule({ n: 2 });
    await vi.advanceTimersByTimeAsync(300);
    t.engine.schedule({ n: 3 });
    expect(t.push).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);
    expect(t.calls).toEqual([{ doc: { n: 3 }, base: 1 }]);
    expect(t.kinds()).toEqual(["syncing", "synced"]);
  });

  it("manda en cada guardado la versión que devolvió el servidor la vez anterior", async () => {
    const t = setup(1);
    t.engine.schedule({ n: 1 });
    await vi.advanceTimersByTimeAsync(800);
    t.engine.schedule({ n: 2 });
    await vi.advanceTimersByTimeAsync(800);
    expect(t.calls.map((c) => c.base)).toEqual([1, 2]);
    expect(t.synced).toEqual([2, 3]);
    expect(t.engine.getVersion()).toBe(3);
  });

  it("nunca hay dos guardados a la vez: lo escrito durante uno se guarda justo después", async () => {
    const t = setup(1, ["hang"]);
    t.engine.schedule({ n: 1 });
    await vi.advanceTimersByTimeAsync(800);
    expect(t.push).toHaveBeenCalledTimes(1);

    t.engine.schedule({ n: 2 }); // mientras el primero sigue en vuelo
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.push).toHaveBeenCalledTimes(1); // no se lanzó otro en paralelo

    t.resolvers[0]!({ ok: true, version: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.calls.map((c) => [c.doc.n, c.base])).toEqual([[1, 1], [2, 2]]); // el segundo usa la versión nueva
    expect(t.engine.isBusy()).toBe(false);
  });

  it("sin conexión reintenta con espera creciente y no pierde el último cambio", async () => {
    const t = setup(1, [{ ok: false, reason: "network" }, { ok: false, reason: "network" }]);
    t.engine.schedule({ n: 7 });
    await vi.advanceTimersByTimeAsync(800);
    expect(t.states.at(-1)).toEqual({ kind: "offline", retryInMs: 5000 });

    await vi.advanceTimersByTimeAsync(5000);
    expect(t.states.at(-1)).toEqual({ kind: "offline", retryInMs: 10_000 }); // 2.º intento: espera el doble

    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.calls.map((c) => c.doc.n)).toEqual([7, 7, 7]); // siempre el mismo contenido
    expect(t.states.at(-1)).toMatchObject({ kind: "synced" });
  });

  it("la espera entre reintentos tiene tope", async () => {
    const t = setup(1, Array.from({ length: 8 }, () => ({ ok: false, reason: "network" }) as PushResult));
    t.engine.schedule({ n: 1 });
    await vi.advanceTimersByTimeAsync(800);
    for (let i = 0; i < 7; i++) await vi.advanceTimersByTimeAsync(60_000);
    const waits = t.states.filter((s): s is Extract<SyncState, { kind: "offline" }> => s.kind === "offline").map((s) => s.retryInMs);
    expect(Math.max(...waits)).toBe(60_000);
  });

  it("un conflicto detiene todo guardado hasta que se resuelva", async () => {
    const t = setup(1, [{ ok: false, reason: "conflict", version: 5 }]);
    t.engine.schedule({ n: 1 });
    await vi.advanceTimersByTimeAsync(800);
    expect(t.states.at(-1)).toEqual({ kind: "conflict", serverVersion: 5 });

    t.engine.schedule({ n: 2 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.push).toHaveBeenCalledTimes(1); // no insiste mientras hay conflicto

    await t.engine.resolve({ n: 2 }, 5); // la persona eligió conservar lo suyo
    expect(t.calls.at(-1)).toEqual({ doc: { n: 2 }, base: 5 });
    expect(t.states.at(-1)).toMatchObject({ kind: "synced" });
  });

  it("adoptar la versión del servidor descarta lo pendiente y retoma desde esa versión", async () => {
    const t = setup(1, [{ ok: false, reason: "conflict", version: 5 }]);
    t.engine.schedule({ n: 1 });
    await vi.advanceTimersByTimeAsync(800);
    t.engine.adopt(5);
    expect(t.states.at(-1)).toEqual({ kind: "synced", version: 5 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.push).toHaveBeenCalledTimes(1); // lo pendiente se descartó
    t.engine.schedule({ n: 2 });
    await vi.advanceTimersByTimeAsync(800);
    expect(t.calls.at(-1)).toEqual({ doc: { n: 2 }, base: 5 });
  });

  it("una sesión vencida detiene el guardado y se retoma con resume()", async () => {
    const t = setup(1, [{ ok: false, reason: "unauthorized" }]);
    t.engine.schedule({ n: 1 });
    await vi.advanceTimersByTimeAsync(800);
    expect(t.states.at(-1)).toEqual({ kind: "unauthorized" });
    t.engine.schedule({ n: 2 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.push).toHaveBeenCalledTimes(1);
    await t.engine.resume();
    expect(t.calls.at(-1)!.doc).toEqual({ n: 2 });
  });

  it("un contenido rechazado no se reintenta solo, pero el próximo cambio sí se prueba", async () => {
    const t = setup(1, [{ ok: false, reason: "invalid" }]);
    t.engine.schedule({ n: 1 });
    await vi.advanceTimersByTimeAsync(800);
    expect(t.states.at(-1)).toEqual({ kind: "rejected" });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(t.push).toHaveBeenCalledTimes(1);
    t.engine.schedule({ n: 2 });
    await vi.advanceTimersByTimeAsync(800);
    expect(t.push).toHaveBeenCalledTimes(2);
  });

  it("flushNow guarda de inmediato (migrar el borrador al crear la cuenta)", async () => {
    const t = setup(null);
    await t.engine.flushNow({ n: 1 });
    expect(t.calls).toEqual([{ doc: { n: 1 }, base: null }]);
  });

  it("si el guardado lanza una excepción lo trata como falta de conexión", async () => {
    const states: SyncState[] = [];
    const engine = createSyncEngine<Doc>({ push: async () => { throw new Error("boom"); }, onState: (s) => states.push(s) }, 1);
    engine.schedule({ n: 1 });
    await vi.advanceTimersByTimeAsync(800);
    expect(states.at(-1)?.kind).toBe("offline");
    engine.dispose();
  });

  it("dispose cancela lo pendiente y ya no avisa nada", async () => {
    const t = setup();
    t.engine.schedule({ n: 1 });
    t.engine.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.push).not.toHaveBeenCalled();
    expect(t.states).toHaveLength(0);
  });
});
