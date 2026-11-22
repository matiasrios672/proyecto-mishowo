import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetSite, siteExists } from "./siteExists";

const reply = (status: number) => new Response("{}", { status });
let spy: ReturnType<typeof vi.spyOn>;

beforeEach(() => { spy = vi.spyOn(globalThis, "fetch"); });
afterEach(() => { spy.mockRestore(); });

describe("siteExists", () => {
  it("200 = existe, 404 = no existe, y lo recuerda un rato (no vuelve a preguntar)", async () => {
    spy.mockResolvedValueOnce(reply(200)).mockResolvedValueOnce(reply(404));
    expect(await siteExists("uno-a", 1000)).toBe(true);
    expect(await siteExists("uno-a", 5000)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await siteExists("dos-b", 1000)).toBe(false);
    expect(await siteExists("dos-b", 2000)).toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("después del tiempo de espera vuelve a preguntar", async () => {
    spy.mockResolvedValueOnce(reply(200)).mockResolvedValueOnce(reply(404));
    expect(await siteExists("vence-c", 0)).toBe(true);
    expect(await siteExists("vence-c", 16_000)).toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("forgetSite (aviso de que la página cambió) hace que se vuelva a consultar enseguida", async () => {
    spy.mockResolvedValueOnce(reply(200)).mockResolvedValueOnce(reply(404));
    expect(await siteExists("olvida-d", 0)).toBe(true);
    forgetSite("olvida-d");
    expect(await siteExists("olvida-d", 10)).toBe(false);
  });

  it("un error del servidor no se cachea ni se toma como 'no existe'", async () => {
    spy.mockResolvedValueOnce(reply(500)).mockResolvedValueOnce(reply(200));
    expect(await siteExists("error-e", 0)).toBe(true);
    expect(await siteExists("error-e", 10)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2); // la 500 no quedó guardada
  });

  it("si el backend no responde no bloquea a nadie", async () => {
    spy.mockRejectedValueOnce(new Error("sin red"));
    expect(await siteExists("sinred-f", 0)).toBe(true);
  });

  it("la memoria tiene tope: no crece sin límite con subdominios al azar", async () => {
    spy.mockImplementation(async () => reply(404));
    for (let i = 0; i < 2100; i++) await siteExists(`azar-${i}`, 0);
    const g = globalThis as { __siteExists?: Map<string, unknown> };
    expect(g.__siteExists!.size).toBeLessThanOrEqual(2000);
  });
});
