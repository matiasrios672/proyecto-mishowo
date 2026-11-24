import { test, expect, type Browser, type Page } from "@playwright/test";
import { PASS, mailSubjects, sql, tokenFromMail, totpNow, uniq, autoConfirm } from "./helpers";

// Requiere el stack completo y Docker accesible (se nombra al admin por SQL). Modifica datos globales (plantillas y planes):
// todo lo que cambia lo deja como estaba, y corre solo en la versión de computadora y en orden.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => { test.skip(info.project.name === "mobile", "el admin es de escritorio"); });

const BASE = "http://localhost:3100";
async function newPage(browser: Browser) {
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  await autoConfirm(page);
  return { context, page };
}

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
  await page.getByLabel(/^Código de 6 dígitos/).fill(totpNow(secret));
  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByRole("navigation", { name: "Administración" })).toBeVisible();
  return secret;
}

test("el sysadmin edita una plantilla con vista previa, prueba el mail y vuelve al original", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const mail = `${uniq("owner-mail", info.project.name)}@test.com`;
  const { page } = await newPage(browser);
  await makeAdmin(page, mail, "owner");

  await page.getByRole("link", { name: "Emails", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Emails", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Plan activado/ }).click();

  const subject = page.getByLabel(/^Asunto/);
  const body = page.getByLabel(/^Mensaje/);
  await subject.fill("¡Listo! Tu plan {{plan}} ya está andando");
  await body.fill("Gracias por sumarte a MiShowo. Tu plan {{plan}} dura hasta el {{until}}.");
  // Vista previa en vivo, con datos de ejemplo y el HTML de la marca
  const preview = page.frameLocator('iframe[title^="Vista previa"]');
  await expect(preview.getByRole("heading", { name: /¡Listo! Tu plan Pro ya está andando/ })).toBeVisible();
  await expect(preview.getByText("Gracias por sumarte a MiShowo. Tu plan Pro dura hasta el 23/12/2026.")).toBeVisible();

  // Una variable inventada se rechaza con un mensaje claro y no se guarda
  await body.fill("Hola {{inventada}} {{plan}} {{until}}");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "variable que no existe" })).toBeVisible();
  await body.fill("Gracias por sumarte a MiShowo. Tu plan {{plan}} dura hasta el {{until}}.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Guardado" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Plan activado/ })).toContainText("EDITADO");

  // La prueba llega al mail de quien la pide, con el texto nuevo
  await page.getByRole("button", { name: "Mandarme una prueba" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Te mandamos una prueba a ${mail}` })).toBeVisible();
  await expect.poll(async () => (await mailSubjects(mail)).some((s) => s.startsWith("[PRUEBA] ¡Listo! Tu plan Pro ya está andando"))).toBe(true);

  // Volver al original deja todo como estaba
  await page.getByRole("button", { name: "Volver al original" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Volvió al texto original" })).toBeVisible();
  await expect(page.getByLabel(/^Asunto/)).toHaveValue("¡Tu plan {{plan}} está activo!");
  await expect(page.getByRole("button", { name: /Plan activado/ })).not.toContainText("EDITADO");
});

test("los mails de acceso no se pueden apagar ni dejar sin enlace", async ({ browser }, info) => {
  const { page } = await newPage(browser);
  await makeAdmin(page, `${uniq("owner-lock", info.project.name)}@test.com`, "owner");
  await page.goto("/admin/emails");
  await page.getByRole("button", { name: /Recuperar contraseña/ }).click();
  await expect(page.getByText("Este mail no se puede apagar")).toBeVisible();
  await expect(page.getByLabel("Enviar este mail automáticamente")).toHaveCount(0);
  await page.getByLabel(/^Mensaje/).fill("Entrá a MiShowo y listo, sin ningún enlace para nadie.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "tiene que incluir" })).toBeVisible();
});

test("módulos por plan: el sysadmin enciende y apaga turnos y se guarda", async ({ browser }, info) => {
  test.setTimeout(90_000);
  const { page } = await newPage(browser);
  await makeAdmin(page, `${uniq("owner-mod", info.project.name)}@test.com`, "owner");
  await page.goto("/admin/planes");
  const proForm = page.getByTestId("plan-form").filter({ hasText: "(pro)" });
  const turnos = proForm.getByLabel(/Turnos con calendario/);
  const before = await turnos.isChecked();
  await turnos.setChecked(!before);
  await proForm.getByRole("button", { name: /^Guardar/ }).click();
  await expect(proForm.getByRole("status")).toContainText("Guardado");
  await page.reload();
  await expect(page.getByTestId("plan-form").filter({ hasText: "(pro)" }).getByLabel(/Turnos con calendario/)).toBeChecked({ checked: !before });
  // se deja como estaba
  const again = page.getByTestId("plan-form").filter({ hasText: "(pro)" });
  await again.getByLabel(/Turnos con calendario/).setChecked(before);
  await again.getByRole("button", { name: /^Guardar/ }).click();
  await expect(again.getByRole("status")).toContainText("Guardado");
});

test("consultas: llega desde Contacto, soporte la responde y el cliente recibe el mail", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const customer = `${uniq("cliente", info.project.name)}@test.com`;
  const { page: visitor } = await newPage(browser);
  await visitor.goto("/contacto");
  await visitor.getByLabel(/^Nombre y apellido/).fill("Lupe Gómez");
  await visitor.getByLabel(/^Email/).fill(customer);
  await visitor.getByLabel(/^¿En qué te ayudamos\?/).fill("¿Cómo cambio mi plan?");
  await visitor.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(visitor.getByTestId("contact-done")).toBeVisible();

  const support = await newPage(browser);
  await makeAdmin(support.page, `${uniq("soporte", info.project.name)}@test.com`, "support");
  await support.page.getByRole("link", { name: "Consultas", exact: true }).click();
  await support.page.getByRole("searchbox", { name: /Buscar por email/ }).fill(customer);
  await support.page.getByRole("button", { name: "Buscar" }).click();
  const item = support.page.getByTestId("inbox").getByRole("listitem").filter({ hasText: customer });
  await expect(item).toContainText("¿Cómo cambio mi plan?");
  await item.getByRole("button", { name: "Atender" }).click();
  await item.getByLabel(/^Respuesta para/).fill("Podés cambiarlo desde Plan y pagos, en tu panel.");
  await item.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(support.page.getByTestId("inbox-notice")).toContainText(`Respuesta enviada a ${customer}`);
  await expect.poll(async () => (await mailSubjects(customer)).some((s) => s.startsWith("Re: tu consulta"))).toBe(true);
  await support.page.getByRole("button", { name: /^Resueltas/ }).click();
  await expect(support.page.getByTestId("inbox")).toContainText(customer);
});

test("el Owner suma a alguien al equipo: le llega la invitación, elige su contraseña y entra", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const staff = `${uniq("nuevo-equipo", info.project.name)}@test.com`;
  const owner = await newPage(browser);
  await makeAdmin(owner.page, `${uniq("owner-team", info.project.name)}@test.com`, "owner");
  await owner.page.getByRole("link", { name: "Equipo", exact: true }).click();
  const form = owner.page.getByTestId("invite-form");
  await form.getByRole("textbox", { name: /^Nombre/ }).fill("Sofi Ramos");
  await form.getByRole("textbox", { name: /^Email/ }).fill(staff);
  await form.getByLabel("Plantilla").selectOption("support");
  await form.getByRole("button", { name: "Invitar" }).click();
  await expect(form.getByRole("status")).toContainText("le llegó un mail");

  const token = await tokenFromMail(staff);
  const { page } = await newPage(browser);
  await page.goto(`/restablecer?token=${encodeURIComponent(token)}`);
  await page.getByLabel(/^Contraseña nueva/).fill(PASS);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();
  await page.goto("/ingresar");
  await page.getByLabel(/^Email/).fill(staff);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL("**/admin**");
  await expect(page.getByTestId("setup-start")).toBeVisible(); // lo primero que le pide es configurar el 2FA
});

test("el Owner da permisos a medida: la persona ve solo lo suyo y el cambio rige sin volver a ingresar", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const staff = `${uniq("permisos", info.project.name)}@test.com`;
  const owner = await newPage(browser);
  await makeAdmin(owner.page, `${uniq("owner-perm", info.project.name)}@test.com`, "owner");
  await owner.page.getByRole("link", { name: "Equipo", exact: true }).click();

  // Alta con permisos a medida: plantilla Soporte, pero con Pagos en «Ver» y sin Consultas.
  const form = owner.page.getByTestId("invite-form");
  await form.getByRole("textbox", { name: /^Nombre/ }).fill("Pedro Pagos");
  await form.getByRole("textbox", { name: /^Email/ }).fill(staff);
  await expect(form.getByTestId("permissions-state")).toContainText("Son los de la plantilla");
  await form.getByLabel("Pagos: Ver", { exact: true }).check();
  await form.getByLabel("Consultas: Sin acceso", { exact: true }).check();
  await expect(form.getByTestId("permissions-state")).toContainText("Permisos personalizados");
  await form.getByRole("button", { name: "Invitar" }).click();
  await expect(form.getByRole("status")).toContainText("le llegó un mail");
  const row = owner.page.getByTestId("team-member").filter({ hasText: staff });
  await expect(row).toContainText("permisos a medida");
  await expect(row).toContainText("Ve: ");

  // La persona elige su contraseña, configura el 2FA y ve solo lo que se le dio.
  const token = await tokenFromMail(staff);
  const { page } = await newPage(browser);
  await page.goto(`/restablecer?token=${encodeURIComponent(token)}`);
  await page.getByLabel(/^Contraseña nueva/).fill(PASS);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();
  await page.goto("/ingresar");
  await page.getByLabel(/^Email/).fill(staff);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL("**/admin**");
  await page.getByTestId("setup-start").click();
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await page.getByLabel(/^Código de 6 dígitos/).fill(totpNow(secret));
  await page.getByRole("button", { name: "Activar" }).click();
  const nav = page.getByRole("navigation", { name: "Administración" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Pagos", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Negocios", exact: true })).toBeVisible();
  for (const hidden of ["Consultas", "Planes", "Auditoría", "Equipo"]) await expect(nav.getByRole("link", { name: hidden, exact: true })).toHaveCount(0);
  await nav.getByRole("link", { name: "Pagos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pagos", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar un pago manual" })).toHaveCount(0); // solo puede ver
  expect((await page.request.get("http://localhost:4000/admin/contact")).status()).toBe(403); // el servidor también se lo niega (no es solo el menú)

  // El Owner le sube Pagos a «Gestionar»: rige al recargar, sin cerrar sesión.
  await row.getByRole("button", { name: "Permisos" }).click();
  await row.getByLabel("Pagos: Gestionar", { exact: true }).check();
  await row.getByRole("button", { name: "Guardar permisos" }).click();
  await expect(row.getByRole("status")).toContainText("Guardado");
  await expect(row).toContainText("Gestiona: Pagos");
  await page.reload();
  await expect(page.getByRole("button", { name: "Registrar un pago manual" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Administración" }).getByRole("link", { name: "Consultas", exact: true })).toHaveCount(0);
});

test("la página de baja de novedades explica qué pasa y no deja entrar con un enlace roto", async ({ page }) => {
  await page.goto("/baja");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("incompleto");
  await page.goto("/baja?token=" + "a".repeat(60));
  await page.getByRole("button", { name: "Sí, darme de baja" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("no es válido");
});

test("leads: quien se registra y no publica aparece en el embudo y el sysadmin le puede escribir", async ({ browser }, info) => {
  test.setTimeout(150_000);
  const lead = `${uniq("lead", info.project.name)}@test.com`;
  const { page: visitor } = await newPage(browser);
  await visitor.goto("/crear?utm_source=instagram");
  await visitor.getByLabel("Nombre", { exact: true }).fill("Sofi Lead");
  await visitor.getByLabel("Apellido").fill("Prueba");
  await visitor.getByLabel(/^Teléfono/).fill("11 5555-0000");
  await visitor.getByLabel(/^Email/).fill(lead);
  await visitor.getByLabel(/^Contraseña/).fill(PASS);
  await visitor.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(visitor.getByRole("heading", { name: "¿De qué es tu negocio?" })).toBeVisible(); // se registró y se fue sin elegir rubro
  sql(`update users set email_verified_at = now() where email = '${lead}'`);

  const owner = await newPage(browser);
  await makeAdmin(owner.page, `${uniq("owner-leads", info.project.name)}@test.com`, "owner");
  await owner.page.getByRole("link", { name: "Leads", exact: true }).click();
  await expect(owner.page.getByTestId("funnel")).toContainText("Confirmó el email, sin página");
  await owner.page.getByRole("searchbox", { name: /Buscar por email/ }).fill(lead);
  await owner.page.getByRole("button", { name: "Buscar" }).click();
  const row = owner.page.getByTestId("lead-row").filter({ hasText: lead });
  await expect(row).toContainText("Sofi Lead");
  await expect(row).toContainText("Confirmó el email, sin página");
  await expect(row).toContainText("instagram"); // de dónde llegó

  // El mail viene apagado de fábrica: primero avisa y no marca a nadie; prendido, sale.
  await row.getByRole("button", { name: "Escribirle" }).click();
  await expect(owner.page.getByRole("alert").filter({ hasText: "está apagado" })).toBeVisible();
  await owner.page.goto("/admin/emails");
  await owner.page.getByRole("button", { name: /Retomar tu página/ }).click();
  await owner.page.getByLabel("Enviar este mail automáticamente").check();
  await owner.page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(owner.page.getByRole("status").filter({ hasText: "Guardado" })).toBeVisible();
  await owner.page.goto("/admin/leads");
  await owner.page.getByRole("searchbox", { name: /Buscar por email/ }).fill(lead);
  await owner.page.getByRole("button", { name: "Buscar" }).click();
  await owner.page.getByTestId("lead-row").filter({ hasText: lead }).getByRole("button", { name: "Escribirle" }).click();
  await expect(owner.page.getByRole("status").filter({ hasText: `Le escribimos a ${lead}` })).toBeVisible();
  await expect.poll(async () => (await mailSubjects(lead)).some((s) => s.startsWith("¿Seguimos con tu página"))).toBe(true);

  // se deja como estaba (apagado)
  await owner.page.goto("/admin/emails");
  await owner.page.getByRole("button", { name: /Retomar tu página/ }).click();
  await owner.page.getByLabel("Enviar este mail automáticamente").uncheck();
  await owner.page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(owner.page.getByRole("status").filter({ hasText: "Guardado" })).toBeVisible();
});
