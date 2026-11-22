import { test, expect } from "@playwright/test";
import { PASS, signUp, uniq } from "./helpers";

test("quien ya armó su página entra al panel; el editor está a un clic y tiene salida al panel", async ({ page }, info) => {
  test.setTimeout(90_000);
  const mail = `${uniq("vuelve", info.project.name)}@test.com`;
  await signUp(page, mail); // primera vez: arma su página en el editor
  await page.context().clearCookies();

  await page.goto("/ingresar");
  await page.getByLabel(/^Email/).fill(mail);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/panel/pedidos");
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();

  if (info.project.name === "mobile") await page.getByRole("button", { name: "Menú" }).click();
  const nav = page.getByRole("navigation", { name: "Panel del negocio" });
  await expect(nav.getByRole("link", { name: "Pedidos" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Diseñar mi página" }).click();
  await page.waitForURL("**/editor");
  // El editor vive dentro del mismo panel: la barra lateral sigue ahí, y desde ella se vuelve a Pedidos.
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Menú" }).click();
  const nav2 = page.getByRole("navigation", { name: "Panel del negocio" });
  await expect(nav2.getByRole("link", { name: "Diseñar mi página" })).toHaveAttribute("aria-current", "page");
  await nav2.getByRole("link", { name: "Pedidos" }).click();
  await page.waitForURL("**/panel/pedidos");
});

test("quien todavía no armó su página va al editor", async ({ page }, info) => {
  const mail = `${uniq("nuevo", info.project.name)}@test.com`;
  const res = await page.request.post("http://localhost:4000/auth/register", { headers: { origin: "http://localhost:3100" }, data: { email: mail, password: PASS } });
  expect(res.ok()).toBe(true);
  await page.context().clearCookies();

  await page.goto("/ingresar");
  await page.getByLabel(/^Email/).fill(mail);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/editor");
});

test("un ?next explícito siempre gana", async ({ page }, info) => {
  const mail = `${uniq("next", info.project.name)}@test.com`;
  await signUp(page, mail);
  await page.context().clearCookies();
  await page.goto("/ingresar?next=/panel/qr");
  await page.getByLabel(/^Email/).fill(mail);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL("**/panel/qr");
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
