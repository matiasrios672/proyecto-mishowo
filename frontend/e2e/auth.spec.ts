import { test, expect, type Page } from "@playwright/test";
import { signOutFromShell } from "./helpers";

// Requiere el stack: `docker compose up -d` (backend + Mailpit en :8025).
const MAILPIT = "http://localhost:8025/api/v1";
const PASS = "claveSegura123";

const uniqueEmail = (tag: string, project: string) => `${tag}-${project}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

/** Espera el N-ésimo mail para una casilla y devuelve el token del enlace que trae. */
async function tokenFromMail(to: string, count = 1): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    if ((list.messages?.length ?? 0) >= count) {
      const msg = await (await fetch(`${MAILPIT}/message/${list.messages[0].ID}`)).json();
      const m = (msg.Text as string).match(/token=([^\s&]+)/);
      if (m) return decodeURIComponent(m[1]!);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No llegó el mail a ${to}`);
}

async function startDraft(page: Page) {
  await page.goto("/probar");
  await page.getByRole("button", { name: "Usar este diseño para mi página" }).click(); // la demo de la landing deja un borrador y pide la cuenta
  await page.waitForURL("**/registro**");
}

async function register(page: Page, email: string) {
  await page.getByLabel("Tu nombre (opcional)").fill("Ana");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Contraseña/).fill(PASS);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await page.waitForURL("**/editor");
}

test.describe("cuentas", () => {
  test("registrarse, confirmar el email desde el enlace del mail y que el aviso desaparezca", async ({ page }, info) => {
    const email = uniqueEmail("reg", info.project.name);
    await startDraft(page);
    await register(page, email);

    await expect(page.getByTestId("account")).toContainText(email);
    await expect(page.getByTestId("verify-banner")).toBeVisible();
    await expect(page.getByTestId("header-name")).toContainText("Rotisería Doña Marta"); // el borrador sigue ahí

    const token = await tokenFromMail(email);
    await page.goto(`/verificar?token=${encodeURIComponent(token)}`);
    await expect(page.getByText("¡Listo! Tu email quedó confirmado.")).toBeVisible();

    await page.getByRole("link", { name: "Ir a mi página" }).click();
    await page.waitForURL("**/editor");
    await expect(page.getByTestId("account")).toContainText(email);
    await expect(page.getByTestId("verify-banner")).toHaveCount(0);

    // el mismo enlace ya no sirve
    await page.goto(`/verificar?token=${encodeURIComponent(token)}`);
    await expect(page.getByText(/venció o ya se usó/)).toBeVisible();
  });

  test("un email repetido y una contraseña corta se explican en castellano", async ({ page }, info) => {
    const email = uniqueEmail("dup", info.project.name);
    await startDraft(page);
    await register(page, email);
    await signOutFromShell(page);
    await expect(page.getByTestId("crear-account")).toBeVisible(); // sin sesión y sin borrador: vuelve al inicio del recorrido, sin rastro de la cuenta

    await page.goto("/registro");
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Contraseña/).fill(PASS);
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.locator("p[role=alert]:visible")).toContainText("Ya hay una cuenta con ese email");

    await page.getByLabel(/^Email/).fill(uniqueEmail("corta", info.project.name));
    await page.getByLabel(/^Contraseña/).fill("corta");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.locator("p[role=alert]:visible")).toContainText("al menos 8 caracteres");
  });

  test("ingresar, equivocarse de contraseña y salir", async ({ page }, info) => {
    const email = uniqueEmail("login", info.project.name);
    await startDraft(page);
    await register(page, email);
    await signOutFromShell(page);

    await page.goto("/ingresar?next=/editor");
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Contraseña/).fill("incorrecta999");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.locator("p[role=alert]:visible")).toContainText("El email o la contraseña no son correctos");

    await page.getByLabel(/^Contraseña/).fill(PASS);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(/\/(editor|panel\/inicio)/);
    await expect(page.getByTestId("account")).toContainText(email);

    await page.reload(); // la sesión sobrevive a recargar
    await expect(page.getByTestId("account")).toContainText(email);
    await signOutFromShell(page);
    await page.reload(); // y el cierre es real, no solo visual
    await expect(page.getByTestId("crear-account")).toBeVisible();
  });

  test("recuperar la contraseña con el enlace del mail", async ({ page }, info) => {
    const email = uniqueEmail("rec", info.project.name);
    await startDraft(page);
    await register(page, email);
    await signOutFromShell(page);

    await page.goto("/recuperar");
    await page.getByLabel(/^Email/).fill(email);
    await page.getByRole("button", { name: "Enviarme el enlace" }).click();
    await expect(page.getByText(/te mandamos un enlace para elegir una contraseña nueva/)).toBeVisible();

    const token = await tokenFromMail(email, 2); // el 1.º fue el de verificación
    await page.goto(`/restablecer?token=${encodeURIComponent(token)}`);
    await page.getByLabel(/^Contraseña nueva/).fill("otraClave456789");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByText(/ya cambiaste tu contraseña/)).toBeVisible();

    await page.getByRole("link", { name: "Ingresar" }).click();
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Contraseña/).fill(PASS); // la vieja ya no entra
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.locator("p[role=alert]:visible")).toContainText("no son correctos");
    await page.getByLabel(/^Contraseña/).fill("otraClave456789");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(/\/(editor|panel\/inicio)/);
  });

  test("entrar con un enlace mágico crea la cuenta ya verificada", async ({ page }, info) => {
    const email = uniqueEmail("magic", info.project.name);
    await page.goto("/ingresar");
    await page.getByRole("tab", { name: "Con un enlace al email" }).click();
    await page.getByLabel(/^Email/).fill(email);
    await page.getByRole("button", { name: "Enviarme el enlace" }).click();
    await expect(page.getByText(/Te mandamos un enlace a/)).toBeVisible();

    const token = await tokenFromMail(email);
    await page.goto(`/enlace?token=${encodeURIComponent(token)}`);
    await page.getByRole("button", { name: "Entrar a MiShowo" }).click(); // exige un clic: un escáner de links no lo gasta
    await page.waitForURL(/\/(editor|panel\/inicio)/);
    await page.goto("/crear");
    await page.getByRole("button", { name: /Rotisería y comidas/ }).click();
    await page.getByTestId("orders-yes").click();
    await page.waitForURL("**/editor");
    await expect(page.getByTestId("account")).toContainText(email);
    await expect(page.getByTestId("verify-banner")).toHaveCount(0); // el enlace prueba que el email es suyo
  });

  test("el parámetro next solo acepta rutas internas", async ({ page }, info) => {
    const email = uniqueEmail("next", info.project.name);
    await startDraft(page);
    await register(page, email);
    await signOutFromShell(page);

    await page.goto("/ingresar?next=//evil.example.com");
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Contraseña/).fill(PASS);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(/\/(editor|panel\/inicio)/);
    expect(new URL(page.url()).hostname).toBe("localhost");
  });

  test("pantallas de cuenta en celular sin desbordes", async ({ page }, info) => {
    for (const path of ["/registro", "/ingresar", "/recuperar"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, path).toBe(false);
    }
    await page.goto("/registro");
    await page.screenshot({ path: `test-results/registro-${info.project.name}.png` });
  });
});
