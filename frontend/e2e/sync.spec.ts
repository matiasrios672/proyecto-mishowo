import { test, expect, type Browser, type Page } from "@playwright/test";
import { signOutFromShell } from "./helpers";

// Requiere el stack (`docker compose up -d`): backend + Postgres.
const BASE = "http://localhost:3100";
const PASS = "claveSegura123";
const status = (page: Page) => page.getByTestId("save-status");
const nameField = (page: Page) => page.getByLabel(/Nombre del negocio/);
const email = (tag: string, project: string) => `${tag}-${project}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

async function newDevice(browser: Browser) {
  const context = await browser.newContext({ baseURL: BASE });
  return { context, page: await context.newPage() };
}

async function startDraft(page: Page, rubro?: string) {
  await page.goto("/probar");
  if (rubro) await page.getByTestId("live-demo").getByRole("button", { name: rubro }).click();
  await page.getByRole("button", { name: "Usar este diseño para mi página" }).click(); // la demo de la landing deja un borrador y pide la cuenta
  await page.waitForURL("**/registro**");
}

async function signUp(page: Page, mail: string) {
  await startDraft(page);
  await page.getByLabel(/^Email/).fill(mail);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await page.waitForURL("**/editor");
  await expect(status(page)).toHaveText("Guardado en tu cuenta", { timeout: 10_000 }); // el borrador se migró
}

async function signIn(page: Page, mail: string) {
  await page.goto("/ingresar?next=/editor");
  await page.getByLabel(/^Email/).fill(mail);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/editor");
}

async function rename(page: Page, value: string) {
  await nameField(page).fill(value);
  await expect(page.getByTestId("header-name")).toHaveText(value);
  await expect(status(page)).toHaveText("Guardado en tu cuenta", { timeout: 10_000 });
}

test.describe("guardado en la cuenta", () => {
  test("el borrador se migra al crear la cuenta y se abre igual en otro dispositivo", async ({ browser }, info) => {
    const mail = email("mig", info.project.name);
    const a = await newDevice(browser);
    await signUp(a.page, mail);
    await rename(a.page, "Panadería del Sol");

    const b = await newDevice(browser); // otra compu: no tiene nada guardado localmente
    await signIn(b.page, mail);
    await expect(b.page.getByTestId("header-name")).toHaveText("Panadería del Sol");
    await expect(b.page.getByTestId("preview-frame")).toContainText("Empanada de humita"); // y el catálogo migró completo
    await a.context.close(); await b.context.close();
  });

  test("cerrar sesión no deja el borrador en la computadora y al volver se recupera de la cuenta", async ({ browser }, info) => {
    const mail = email("out", info.project.name);
    const { context, page } = await newDevice(browser);
    await signUp(page, mail);
    await rename(page, "Mi negocio privado");

    await signOutFromShell(page);
    await expect(page.getByTestId("crear-account")).toBeVisible();
    const left = await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith("mishowo:draft") || k.startsWith("mishowo:sync")));
    expect(left).toEqual([]); // nada del negocio queda en el navegador

    await signIn(page, mail);
    await expect(page.getByTestId("header-name")).toHaveText("Mi negocio privado");
    await context.close();
  });

  test("dos dispositivos: el desactualizado recibe aviso y puede usar la versión de la cuenta", async ({ browser }, info) => {
    const mail = email("conf", info.project.name);
    const a = await newDevice(browser);
    await signUp(a.page, mail);
    const b = await newDevice(browser);
    await signIn(b.page, mail);
    await expect(status(b.page)).toBeVisible();

    await rename(a.page, "Desde la compu");
    await nameField(b.page).fill("Desde el celular"); // B no sabe lo que hizo A
    await expect(b.page.getByTestId("conflict-banner")).toBeVisible({ timeout: 10_000 });
    await expect(status(b.page)).toContainText("Guardado pausado");

    await b.page.getByRole("button", { name: "Usar la de mi cuenta" }).click();
    await expect(b.page.getByTestId("header-name")).toHaveText("Desde la compu");
    await expect(b.page.getByTestId("conflict-banner")).toHaveCount(0);

    await rename(b.page, "Ya sincronizado"); // y puede seguir editando normalmente
    await a.context.close(); await b.context.close();
  });

  test("dos dispositivos: elegir quedarse con lo propio pisa la cuenta, y el otro dispositivo se entera", async ({ browser }, info) => {
    const mail = email("mine", info.project.name);
    const a = await newDevice(browser);
    await signUp(a.page, mail);
    const b = await newDevice(browser);
    await signIn(b.page, mail);

    await rename(a.page, "Versión de A");
    await nameField(b.page).fill("Versión de B");
    await expect(b.page.getByTestId("conflict-banner")).toBeVisible({ timeout: 10_000 });
    await b.page.getByRole("button", { name: "Quedarme con esta" }).click();
    await expect(status(b.page)).toHaveText("Guardado en tu cuenta", { timeout: 10_000 });
    await expect(b.page.getByTestId("conflict-banner")).toHaveCount(0);

    await a.page.reload(); // A tiene una versión vieja: se le pregunta cuál usar en vez de pisar nada
    await expect(a.page.getByRole("heading", { name: "Ya tenés una página guardada" })).toBeVisible();
    await a.page.getByRole("button", { name: "Usar la página de mi cuenta" }).click();
    await expect(a.page.getByTestId("header-name")).toHaveText("Versión de B");
    await a.context.close(); await b.context.close();
  });

  test("sin conexión sigue editando, avisa, y sube todo cuando vuelve", async ({ browser }, info) => {
    test.setTimeout(60_000);
    const mail = email("off", info.project.name);
    const { context, page } = await newDevice(browser);
    await signUp(page, mail);

    await page.route("**/me/business", (r) => (r.request().method() === "PUT" ? r.abort() : r.continue()));
    await nameField(page).fill("Cambio sin conexión");
    await expect(status(page)).toContainText("Sin conexión", { timeout: 10_000 });
    await expect(page.getByTestId("header-name")).toHaveText("Cambio sin conexión"); // el editor sigue funcionando

    await page.unroute("**/me/business");
    await expect(status(page)).toHaveText("Guardado en tu cuenta", { timeout: 20_000 }); // reintento automático

    const server = await page.evaluate(async () => (await (await fetch("http://localhost:4000/me/business", { credentials: "include" })).json()).content.name);
    expect(server).toBe("Cambio sin conexión");
    await context.close();
  });

  test("si la sesión vence avisa, no pierde los cambios y se retoma al volver a ingresar", async ({ browser }, info) => {
    const mail = email("exp", info.project.name);
    const { context, page } = await newDevice(browser);
    await signUp(page, mail);

    await context.clearCookies(); // la sesión desaparece
    await nameField(page).fill("Editado sin sesión");
    await expect(page.getByTestId("unauthorized-banner")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("header-name")).toHaveText("Editado sin sesión");

    await signIn(page, mail);
    await expect(page.getByTestId("header-name")).toHaveText("Editado sin sesión"); // el borrador local se conservó
    await context.close();
  });

  test("con una cuenta que ya tiene página y un borrador distinto en el dispositivo, pregunta cuál usar", async ({ browser }, info) => {
    const mail = email("two", info.project.name);
    const a = await newDevice(browser);
    await signUp(a.page, mail);
    await rename(a.page, "Página guardada");

    const b = await newDevice(browser);
    await startDraft(b.page, "Ropa"); // empieza otro borrador sin cuenta
    await signIn(b.page, mail);
    await expect(b.page.getByRole("heading", { name: "Ya tenés una página guardada" })).toBeVisible();
    await b.page.getByRole("button", { name: "Usar la página de mi cuenta" }).click();
    await expect(b.page.getByTestId("header-name")).toHaveText("Página guardada");
    await a.context.close(); await b.context.close();
  });
});
