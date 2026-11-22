import { test, expect, type Page } from "@playwright/test";
import { PASS, signUp, status, uniq } from "./helpers";

const openMenuIfMobile = async (page: Page, project: string) => {
  if (project === "mobile") await page.getByRole("button", { name: "Menú" }).click();
};

async function loginAs(page: Page, mail: string, next = "") {
  await page.goto(`/ingresar${next}`);
  await page.getByLabel(/^Email/).fill(mail);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test("quien ya armó su página entra al Inicio del panel y navega por los módulos", async ({ page }, info) => {
  test.setTimeout(120_000);
  const mail = `${uniq("vuelve", info.project.name)}@test.com`;
  await signUp(page, mail); // primera vez: arma su página en el editor guiado
  await page.context().clearCookies();

  await loginAs(page, mail);
  await page.waitForURL("**/panel/inicio");
  await expect(page.getByTestId("home-stats")).toBeVisible();
  await expect(page.getByTestId("home-checklist")).toBeVisible();

  await openMenuIfMobile(page, info.project.name);
  const nav = page.getByRole("navigation", { name: "Panel del negocio" });
  await expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  for (const [label, url] of [["Catálogo", "**/panel/catalogo"], ["Mi página", "**/panel/pagina"], ["Ajustes", "**/panel/ajustes"]] as const) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await page.waitForURL(url);
    await expect(page.getByTestId("header-name")).toBeVisible();
    await openMenuIfMobile(page, info.project.name);
  }
  await nav.getByRole("link", { name: "Pedidos" }).click();
  await page.waitForURL("**/panel/pedidos");
});

test("cada módulo muestra solo sus secciones", async ({ page }, info) => {
  test.setTimeout(120_000);
  await signUp(page, `${uniq("mods", info.project.name)}@test.com`);
  const tabs = async (url: string) => {
    await page.goto(url);
    await page.getByRole("tablist", { name: "Secciones del editor" }).waitFor();
    return (await page.getByRole("tab").allInnerTexts()).map((x) => x.split("\n")[0]!.trim());
  };
  expect(await tabs("/panel/catalogo")).toEqual(["Productos", "Fotos"]);
  expect(await tabs("/panel/pagina")).toEqual(["Textos", "Fotos", "Diseño", "SEO y compartir", "Publicar"]);
  expect(await tabs("/panel/ajustes")).toEqual(["Negocio", "Pedidos"]);
});

test("los pendientes del Inicio llevan directo a la sección correcta", async ({ page }, info) => {
  test.setTimeout(120_000);
  await signUp(page, `${uniq("pend", info.project.name)}@test.com`);
  await page.goto("/panel/inicio");
  const checklist = page.getByTestId("home-checklist");
  await expect(checklist).toBeVisible();
  await checklist.getByRole("link", { name: /WhatsApp/ }).click();
  await page.waitForURL(/\/panel\/ajustes\?tab=negocio/);
  await expect(page.getByRole("tab", { name: "Negocio" })).toHaveAttribute("aria-selected", "true");
});

test("un cambio recién tipeado no se pierde al cambiar de módulo", async ({ page }, info) => {
  test.setTimeout(120_000);
  await signUp(page, `${uniq("guard", info.project.name)}@test.com`);
  await page.goto("/panel/ajustes");
  await page.getByLabel(/Nombre del negocio/).fill("Guardado Al Salir");
  await openMenuIfMobile(page, info.project.name);
  await page.getByRole("navigation", { name: "Panel del negocio" }).getByRole("link", { name: "Catálogo", exact: true }).click(); // sin esperar el autoguardado
  await page.waitForURL("**/panel/catalogo");
  await expect(page.getByTestId("header-name")).toHaveText("Guardado Al Salir");
  await expect(status(page)).toHaveText("Guardado en tu cuenta", { timeout: 15_000 });
  await page.reload();
  await expect(page.getByTestId("header-name")).toHaveText("Guardado Al Salir");
});

test("un producto cargado en Catálogo aparece en la vista previa", async ({ page }, info) => {
  test.setTimeout(120_000);
  await signUp(page, `${uniq("cat", info.project.name)}@test.com`);
  await page.goto("/panel/catalogo");
  await page.getByRole("button", { name: /Quitar los \d+ de ejemplo/ }).click();
  await page.getByRole("button", { name: "+ Agregar producto" }).click();
  await page.getByLabel(/^Nombre \*?$/).fill("Alfajor de prueba");
  await page.getByLabel("Precio ($)").fill("1800");
  await expect(status(page)).toHaveText("Guardado en tu cuenta", { timeout: 15_000 });
  if (info.project.name === "mobile") await page.getByTestId("toggle-view").click();
  await expect(page.getByTestId("preview-frame")).toContainText("Alfajor de prueba");
});

test("quien todavía no armó su página va al editor", async ({ page }, info) => {
  const mail = `${uniq("nuevo", info.project.name)}@test.com`;
  const res = await page.request.post("http://localhost:4000/auth/register", { headers: { origin: "http://localhost:3100" }, data: { email: mail, password: PASS } });
  expect(res.ok()).toBe(true);
  await page.context().clearCookies();
  await loginAs(page, mail);
  await page.waitForURL("**/editor");
});

test("un ?next explícito siempre gana", async ({ page }, info) => {
  const mail = `${uniq("next", info.project.name)}@test.com`;
  await signUp(page, mail);
  await page.context().clearCookies();
  await loginAs(page, mail, "?next=/panel/qr");
  await page.waitForURL("**/panel/qr");
});

test("sin sesión, los módulos mandan a ingresar", async ({ page }) => {
  await page.goto("/panel/catalogo");
  await page.waitForURL(/\/ingresar\?next=%2Fpanel%2Fcatalogo/);
});

test("el menú del panel en celular se abre, se cierra con Escape y devuelve el foco", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "solo en celular");
  await signUp(page, `${uniq("menu", info.project.name)}@test.com`);
  await page.goto("/panel/pedidos");
  const btn = page.getByRole("button", { name: "Menú" });
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("navigation", { name: "Panel del negocio" })).toBeHidden();
  await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("navigation", { name: "Panel del negocio" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  await expect(btn).toBeFocused();
});
