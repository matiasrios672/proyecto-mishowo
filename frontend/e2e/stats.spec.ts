import { test, expect } from "@playwright/test";
import { fillBusiness, publishAs, signUp, uniq, verifyEmail } from "./helpers";

// Chromium headless se anuncia como "HeadlessChrome" y el backend (con razón) no cuenta robots: usamos un navegador de celular real.
const REAL_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("estadísticas, QR y SEO de un negocio publicado", async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const mail = `${uniq("stats", info.project.name)}@test.com`;
  const slug = uniq("st", info.project.name).toLowerCase().slice(0, 30);
  const name = `Estadería ${slug.slice(-5)}`;
  await signUp(page, mail);
  await fillBusiness(page, name, { product: "Alfajor de maicena" });
  await verifyEmail(page, mail);
  await publishAs(page, slug);

  // Antes de que entre nadie, el panel lo explica en vez de mostrar ceros mudos
  await page.goto("/panel/estadisticas");
  await expect(page.getByTestId("stats-empty")).toBeVisible();

  // ── Un visitante real entra escaneando el QR y toca el botón de WhatsApp
  const visitor = await browser.newContext({ userAgent: REAL_UA });
  const v = await visitor.newPage();
  const base = `http://${slug}.localhost:3000`;
  const posted: string[] = [];
  v.on("request", (r) => { if (r.url().includes("/events")) posted.push(r.postData() ?? ""); });
  await v.goto(`${base}/?utm_source=qr`);
  await v.locator("[data-product-id]").first().scrollIntoViewIfNeeded();
  await expect.poll(() => posted.filter((p) => p.includes("product_view")).length).toBe(1);
  const wa = v.locator('a[href^="https://wa.me/"]').first();
  await wa.evaluate((a) => a.setAttribute("target", "_self")); // evita abrir WhatsApp de verdad
  await v.route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "ok" }));
  await wa.click();
  await expect.poll(() => posted.filter((p) => p.includes("whatsapp_click")).length).toBe(1);
  expect(posted.some((p) => p.includes('"type":"visit"') && p.includes('"utmSource":"qr"'))).toBe(true);
  await visitor.close();

  // ── El dueño ve los números, separando lo que vino del QR
  await page.goto("/panel/estadisticas");
  const totals = page.getByTestId("stats-totals");
  await expect(totals).toContainText("Visitas");
  await expect(totals.locator("dd").nth(0)).toHaveText("1");
  await expect(totals.locator("dd").nth(1)).toHaveText("1");
  await expect(page.getByTestId("stats-sources")).toContainText("Código QR");
  await expect(page.getByTestId("stats-top")).toContainText("Alfajor de maicena");
  await expect(page.getByTestId("stats-empty")).toHaveCount(0);
  await page.getByRole("button", { name: "Últimos 7 días" }).click();
  await expect(page.getByRole("button", { name: "Últimos 7 días" })).toHaveAttribute("aria-pressed", "true");
  await expect(totals.locator("dd").nth(0)).toHaveText("1");

  // ── QR: se genera, se descarga como PNG y apunta al link con el origen marcado
  await page.goto("/panel/qr");
  await expect(page.getByTestId("qr-poster")).toContainText(name);
  await expect(page.getByTestId("qr-image")).toHaveAttribute("src", /^data:image\/png/);
  await expect(page.getByTestId("qr-image")).toHaveAttribute("alt", new RegExp(`${slug}\\.localhost`));
  const download = page.waitForEvent("download");
  await page.getByTestId("qr-download").click();
  expect((await download).suggestedFilename()).toBe(`qr-${slug}.png`);

  // ── SEO: metadatos sociales, canonical y datos estructurados
  await page.goto(base);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", base); // Next normaliza la raíz sin barra final
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", name);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "es_AR");
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld).toMatchObject({ "@type": "LocalBusiness", name });
  expect(JSON.stringify(ld)).toContain("Alfajor de maicena");

  // ── robots y sitemap son los DEL NEGOCIO, no los del sitio principal
  await page.goto(`${base}/robots.txt`);
  await expect(page.locator("body")).toContainText(`Sitemap: ${base}/sitemap.xml`);
  const sm = await page.request.get(`${base}/sitemap.xml`).catch(() => null);
  if (sm) expect(await sm.text()).toContain(`${base}/`);
  await page.goto("/robots.txt");
  await expect(page.locator("body")).not.toContainText(slug);
});

test("un negocio que no existe no devuelve robots ni sitemap", async ({ page }) => {
  const res = await page.goto("http://no-existe-jamas.localhost:3000/robots.txt");
  expect(res?.status()).toBe(404);
});
