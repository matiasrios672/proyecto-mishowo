import { test, expect, type Browser, type Page } from "@playwright/test";
import { PASS, mailSubjects, signUp, sql, totpNow, uniq, verifyEmail, autoConfirm } from "./helpers";

// Requiere el stack completo (`docker compose up -d --build`) y Docker accesible (se nombra al admin por SQL).
// El admin es de escritorio y modifica datos globales (planes): corre solo en la versión de computadora y en orden.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "el admin es de escritorio"); });

const BASE = "http://localhost:3100";
async function newPage(browser: Browser) {
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  await autoConfirm(page);
  return { context, page };
}

/** Registra una cuenta, la nombra admin por SQL y configura su 2FA desde la interfaz. Devuelve el secreto. */
async function makeAdmin(page: Page, email: string, role: "owner" | "admin" | "support") {
  await page.goto("/registro");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await page.waitForURL("**/editor");
  sql(`update users set role = '${role}' where email = '${email}'`);
  await page.goto("/admin");
  await page.getByTestId("setup-start").click();
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await expect(page.getByAltText("Código QR para la app de autenticación")).toBeVisible();
  await page.getByLabel(/^Código de 6 dígitos/).fill(totpNow(secret));
  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByRole("navigation", { name: "Administración" })).toBeVisible();
  return secret;
}

test("recorrido completo: el usuario avisa su pago, el admin lo confirma y el plan queda activo", async ({ browser }, info) => {
  test.setTimeout(150_000);
  const userMail = `${uniq("comprador", info.project.name)}@test.com`;
  const adminMail = `${uniq("owner", info.project.name)}@test.com`;

  // ── Usuario: crea su negocio y avisa un pago con comprobante
  const u = await newPage(browser);
  await signUp(u.page, userMail);
  await verifyEmail(u.page, userMail);
  await u.page.goto("/planes"); // el enlace corto lleva al panel de planes
  await u.page.waitForURL("**/panel/plan");
  await expect(u.page.getByTestId("current-plan")).toContainText("Gratis");
  await u.page.getByRole("button", { name: /Elegir Emprende/ }).click();
  await u.page.getByLabel("¿Por cuántos meses?").selectOption("3");
  await u.page.locator('input[type="file"]').first().setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 3)]) });
  await u.page.getByLabel(/^Aclaración/).fill("Transferencia de prueba e2e");
  await u.page.getByTestId("paid-button").click();
  await expect(u.page.getByTestId("payment-sent")).toBeVisible();
  const mine = u.page.getByTestId("payment").first();
  await expect(mine).toHaveAttribute("data-status", "pendiente");
  await expect(mine).toContainText("$ 29.700"); // el monto lo calculó el servidor
  await expect(mine).toContainText("con comprobante");

  // ── Admin: configura el 2FA, ve el pago y lo confirma
  const a = await newPage(browser);
  const secret = await makeAdmin(a.page, adminMail, "owner");
  await expect(a.page.getByTestId("kpis")).toBeVisible();
  await a.page.getByRole("link", { name: "Pagos", exact: true }).click();
  const row = a.page.getByTestId("admin-payment").filter({ hasText: userMail });
  await expect(row).toContainText("$ 29.700");
  await expect(row).toContainText("Transferencia de prueba e2e");
  await expect(row.getByRole("link", { name: "Ver comprobante" })).toHaveAttribute("href", /\/admin\/payments\/.+\/receipt$/);
  await row.getByRole("button", { name: "Confirmar pago" }).click();
  await expect(a.page.getByTestId("admin-payment").filter({ hasText: userMail })).toHaveCount(0);
  await a.page.getByRole("tab", { name: "Confirmados" }).click();
  await expect(a.page.getByTestId("admin-payment").filter({ hasText: userMail })).toBeVisible();

  // ── El usuario ve el plan activo y recibió el email
  await u.page.reload();
  await expect(u.page.getByTestId("current-plan")).toContainText("Emprende");
  await expect(u.page.getByTestId("current-plan")).toContainText("activo hasta");
  await expect(u.page.getByTestId("payment").first()).toHaveAttribute("data-status", "confirmado");
  await expect.poll(async () => (await mailSubjects(userMail)).includes("¡Tu plan Emprende está activo!"), { timeout: 15_000 }).toBe(true);

  // ── Queda en la auditoría, con quién lo hizo
  await a.page.getByRole("link", { name: "Auditoría" }).click();
  const audit = a.page.getByTestId("audit-row").filter({ hasText: "payment.confirm" }).first();
  await expect(audit).toContainText(adminMail);

  // ── Nueva sesión: pide el código otra vez; uno incorrecto no entra
  await a.page.getByRole("button", { name: "Cerrar sesión" }).click();
  await a.page.goto("/ingresar?next=/admin");
  await a.page.getByLabel(/^Email/).fill(adminMail);
  await a.page.getByLabel(/^Contraseña/).fill(PASS);
  await a.page.getByRole("button", { name: "Ingresar" }).click();
  await a.page.getByLabel(/^Código de 6 dígitos/).fill(totpNow(secret) === "000000" ? "111111" : "000000");
  await a.page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(a.page.locator("p[role=alert]:visible")).toContainText("no es correcto");
  await expect(a.page.getByRole("navigation", { name: "Administración" })).toHaveCount(0);
  await a.page.getByLabel(/^Código de 6 dígitos/).fill(totpNow(secret));
  await a.page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(a.page.getByRole("navigation", { name: "Administración" })).toBeVisible();
  await u.context.close(); await a.context.close();
});

test("el precio que se edita en el admin se ve enseguida en la landing", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const a = await newPage(browser);
  await makeAdmin(a.page, `${uniq("precios", info.project.name)}@test.com`, "owner");
  await a.page.getByRole("link", { name: "Planes", exact: true }).click();
  const form = a.page.getByTestId("plan-form").filter({ hasText: "emprende" });
  const original = await form.getByLabel("Precio por mes ($)").inputValue();
  try {
    await form.getByLabel("Precio por mes ($)").fill("12345");
    await form.getByRole("button", { name: /^Guardar/ }).click();
    await expect(form.getByRole("status")).toContainText("Guardado");
    await a.page.goto(`${BASE}/precios`);
    await expect(a.page.locator("#planes")).toContainText("$ 12.345");
  } finally {
    await a.page.goto("/admin/planes");
    const again = a.page.getByTestId("plan-form").filter({ hasText: "emprende" });
    await again.getByLabel("Precio por mes ($)").fill(String(Number(original)));
    await again.getByRole("button", { name: /^Guardar/ }).click();
    await expect(again.getByRole("status")).toContainText("Guardado");
  }
  await a.page.goto(`${BASE}/precios`);
  await expect(a.page.locator("#planes")).not.toContainText("$ 12.345");
  await a.context.close();
});

test("el owner carga los datos para transferir y los usuarios los ven al pagar", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const a = await newPage(browser);
  await makeAdmin(a.page, `${uniq("cobro", info.project.name)}@test.com`, "owner");
  await a.page.getByRole("link", { name: "Planes", exact: true }).click();
  const settings = a.page.getByTestId("payment-settings");
  await settings.getByLabel("Alias").fill("mishowo.e2e");
  await settings.getByLabel("Titular").fill("MiShowo E2E");
  await settings.getByLabel(/^CBU/).fill("0000003100000000000009");
  await settings.getByRole("button", { name: "Guardar datos de pago" }).click();
  await expect(settings.getByRole("status")).toContainText("Guardado");
  await settings.getByLabel(/^CBU/).fill("no-son-numeros");
  await settings.getByRole("button", { name: "Guardar datos de pago" }).click();
  await expect(settings.getByRole("alert")).toContainText("solo números");

  const u = await newPage(browser);
  await signUp(u.page, `${uniq("ve-datos", info.project.name)}@test.com`);
  await u.page.goto("/panel/plan");
  await u.page.getByRole("button", { name: /Elegir Pro/ }).click();
  await expect(u.page.getByTestId("payment-form")).toContainText("mishowo.e2e");
  await expect(u.page.getByTestId("payment-form")).toContainText("0000003100000000000009");
  await u.context.close(); await a.context.close();
});

test("Soporte no ve ni puede usar pagos, planes ni moderación", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const a = await newPage(browser);
  await makeAdmin(a.page, `${uniq("soporte", info.project.name)}@test.com`, "support");
  const nav = a.page.getByRole("navigation", { name: "Administración" });
  await expect(nav.getByRole("link", { name: "Negocios" })).toBeVisible();
  for (const hidden of ["Pagos", "Planes", "Auditoría", "Equipo"]) await expect(nav.getByRole("link", { name: hidden })).toHaveCount(0);
  await a.page.goto("/admin/pagos");
  await expect(a.page.locator("p[role=alert]:visible")).toContainText("No tenés permiso para esta acción");
  await a.context.close();
});

test("una persona común no entra al admin", async ({ browser }, info) => {
  const u = await newPage(browser);
  await signUp(u.page, `${uniq("comun", info.project.name)}@test.com`);
  await u.page.goto("/admin");
  await expect(u.page.getByRole("heading", { name: "No tenés acceso" })).toBeVisible();
  await expect(u.page.getByRole("navigation", { name: "Administración" })).toHaveCount(0);
  await u.context.close();
});

test("sin sesión, el admin manda a ingresar", async ({ page }) => {
  await page.goto("/admin/pagos");
  await page.waitForURL(/\/ingresar\?next=%2Fadmin%2Fpagos/);
});
