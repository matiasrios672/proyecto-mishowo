import { test, expect, type Page } from "@playwright/test";

// Requiere el stack (`docker compose up -d`) con los planes sembrados (`npm run db:seed` en backend).
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("landing de MiShowo", () => {
  test("muestra el mensaje principal, las secciones y no se desborda en celular, tablet ni compu", async ({ page }) => {
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1); // la demo no agrega un segundo h1
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Tu negocio, siempre abierto.");
      expect(await noOverflow(page), `@${width}`).toBe(true);
    }
    // La home es corta: la demo y el menú para elegir qué ver. El resto vive en su propia página.
    for (const name of ["Dejá de contestar lo mismo cuarenta veces por día.", "Páginas hechas para negocios como el tuyo", "Empezá gratis, crecé cuando lo necesites", "Que te encuentren y te pidan."])
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Preguntas frecuentes" })).toHaveCount(0); // las preguntas viven en /precios
    await expect(page.getByTestId("live-demo")).toHaveCount(0); // la demo vive en /probar, no en la home
    await expect(page.getByTestId("free-badge")).toHaveCount(0); // sin el cartelito de «plan gratis, sin tarjeta» en el hero
    await expect(page.getByText("Plan gratis para siempre · sin tarjeta")).toHaveCount(0);
    const plans = page.locator("#planes"); // los planes sí se muestran en la home, desde la base de datos
    await expect(plans.getByRole("heading", { name: "Gratis", exact: true })).toBeVisible();
    await expect(plans.getByRole("heading", { name: "Emprende", exact: true })).toBeVisible();
    await expect(plans.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  });

  test("el hero ilustrado: celular que arma la página, dibujos y sin video", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.getByRole("img", { name: /Vista de la página de un negocio/ })).toBeVisible();
    await expect(page.getByLabel("Rubros que usan MiShowo")).toHaveCount(0); // sin carrusel de rubros
    await expect(page.getByRole("link", { name: "Creá tu página gratis" }).first()).toBeVisible();
  });

  test("con movimiento reducido todo queda visible y quieto", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/como-funciona");
    await expect(page.getByRole("heading", { name: "Del celular a tus clientes, en tres pasos" })).toBeVisible();
    await expect(page.getByTestId("steps").getByRole("listitem")).toHaveCount(3);
    await page.goto("/");
    await expect(page.getByRole("img", { name: /Vista de la página de un negocio/ })).toBeVisible(); // el hero ya no tiene cursor ni tarjetas animadas
    await expect(page.locator(".mk-cursor, .mk-notify")).toHaveCount(0);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length)).toBe(0); // nada corre en bucle
    await ctx.close();
  });

  test("los planes (en /precios) salen de la base de datos con precio y límites", async ({ page }) => {
    await page.goto("/precios");
    const plans = page.locator("#planes");
    await expect(plans.getByRole("heading", { name: "Gratis", exact: true })).toBeVisible();
    await expect(plans.getByRole("heading", { name: "Emprende", exact: true })).toBeVisible();
    await expect(plans.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
    await expect(plans).toContainText("Hasta 15 productos");
    await expect(plans).toContainText("Productos ilimitados");
    await expect(plans.getByRole("link", { name: "Empezar gratis" })).toHaveAttribute("href", "/crear");
    await expect(plans.getByRole("link", { name: "Elegir Pro" })).toHaveAttribute("href", /\/registro\?next=/);
  });

  test("demo interactiva (en /probar): el nombre, el rubro y el estilo cambian la vista previa real", async ({ page }) => {
    await page.goto("/probar");
    const demo = page.getByTestId("live-demo");
    const preview = demo.locator("[data-site-layout]");
    await expect(preview).toBeVisible();

    await demo.getByLabel("¿Cómo se llama tu negocio?").fill("Panadería del Sol");
    await expect(demo.getByText("panaderia-del-sol.mishowo.com")).toBeVisible();
    await expect(preview.getByTestId("site-name")).toHaveText("Panadería del Sol");

    await demo.getByRole("button", { name: "Ropa" }).click();
    await expect(preview).toHaveAttribute("data-site-layout", "grilla");
    await expect(preview).toContainText("Remera oversize de algodón");

    await demo.getByRole("radio", { name: "Medianoche" }).click();
    const bg = await preview.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--background"));
    expect(bg.toUpperCase()).toBe("#0F1626");
  });

  test("'Usar este diseño' lleva al editor con ese negocio ya cargado", async ({ page }) => {
    await page.goto("/probar");
    const demo = page.getByTestId("live-demo");
    await demo.getByLabel("¿Cómo se llama tu negocio?").fill("Mi Panadería");
    await demo.getByRole("button", { name: "Belleza" }).click();
    await expect(demo.locator("[data-site-layout]")).toHaveAttribute("data-site-layout", "servicios");
    await demo.getByRole("button", { name: "Usar este diseño para mi página" }).click();
    // Para seguir hace falta cuenta: el diseño elegido viaja con la persona y aparece al crearla.
    await page.waitForURL("**/registro**");
    await page.getByLabel(/^Email/).fill(`demo-${Date.now()}@test.com`);
    await page.getByLabel(/^Contraseña/).fill("claveSegura123");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await page.waitForURL("**/editor");
    await expect(page.getByTestId("header-name")).toHaveText("Mi Panadería");
    await expect(page.getByTestId("preview-frame")).toContainText("Esmaltado semipermanente");
  });

  test("las preguntas frecuentes (en /precios) se abren y se cierran", async ({ page }) => {
    await page.goto("/precios");
    await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]')); // la FAQ llega por streaming: esperar a que termine de reemplazarse
    const q = page.locator("details:visible", { hasText: "¿Cómo cobro?" });
    await expect(q).not.toHaveAttribute("open", "");
    await q.locator("summary").click();
    await expect(q).toContainText("no cobra comisión");
    await q.locator("summary").click();
    await expect(q).not.toHaveAttribute("open", "");
  });

  test("datos estructurados (Organization y SoftwareApplication en la home, FAQPage en /precios) y metadatos para compartir", async ({ page }) => {
    await page.goto("/precios");
    const faq = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(6);
    await page.goto("/");
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    expect(ld["@graph"].map((x: { "@type": string }) => x["@type"])).toEqual(["Organization", "SoftwareApplication"]);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /pedidos por WhatsApp/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  });

  test("la cabecera y el pie llevan a páginas que existen", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.locator("footer a[href^='/']").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!.split("#")[0]!));
    for (const h of new Set(hrefs.filter(Boolean))) expect((await request.get(h)).status(), h).toBe(200);
  });
});

test.describe("páginas de la web (la home es corta y cada tema tiene la suya)", () => {
  const PAGES = [
    ["/como-funciona", "Cómo funciona"],
    ["/rubros", "Una página para cada rubro"],
    ["/cuotas", "Cuotas sin interés"],
    ["/funciones", "Todo lo que incluye"],
    ["/precios", "Precios"],
    ["/probar", "Probalo vos mismo"],
  ] as const;

  for (const [path, title] of PAGES) {
    test(`${path}: un solo h1, sin desbordes, con cierre y vuelta a la home`, async ({ page }) => {
      for (const width of [390, 820, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const res = await page.goto(path);
        expect(res?.status()).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
        expect(await noOverflow(page), `${path} @${width}`).toBe(true);
      }
      await expect(page.getByRole("heading", { name: "Creá tu página gratis", exact: true })).toBeVisible();
      await page.getByRole("navigation", { name: "Ubicación" }).getByRole("link", { name: /Inicio/ }).click();
      await expect(page).toHaveURL("/");
    });
  }

  test("la home muestra una vitrina de seis rubros: uno grande a la vez, con pestañas accesibles", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("tablist", { name: "Rubros" }).getByRole("tab");
    await expect(tabs).toHaveCount(6);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    const title = page.getByTestId("rubro-title");
    await expect(title).toContainText("tienda de ropa");

    // elegir otro rubro cambia el título, el ejemplo y el celular
    await page.getByRole("tab", { name: "Comidas y bares" }).click();
    await expect(title).toHaveText("Tu carta, al día en cada mesa");
    const example = page.getByRole("link", { name: /^Ver el ejemplo de Comidas y bares/ });
    await expect(example).toHaveAttribute("target", "_blank");
    await expect(example).toHaveAttribute("rel", /noopener/);
    await expect(example).toHaveAttribute("href", /lupe-empanadas\./);
    await expect(page.getByTestId("rubro-panel").getByRole("link", { name: "Crear mi página" })).toHaveAttribute("href", "/crear");

    // teclado: flechas, Fin e Inicio (patrón de pestañas)
    await page.getByRole("tab", { name: "Comidas y bares" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Eventos" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Eventos" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: "Oficios y servicios" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("link", { name: /^Ver el ejemplo/ })).toHaveCount(0); // oficios no tiene ejemplo publicado
    await page.keyboard.press("Home");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    // el segundo botón del hero baja a la vitrina y no hay desborde
    await page.getByRole("link", { name: "Ver ejemplos" }).first().click();
    await expect(page).toHaveURL(/#elegi-tu-rubro$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("en celular el menú abre, navega, se cierra solo y responde a Escape", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "solo en celular");
    await page.goto("/");
    const button = page.getByRole("button", { name: "Abrir menú" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(page.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("navigation", { name: "Menú" }).getByRole("link", { name: "Precios" }).click();
    await expect(page).toHaveURL(/\/precios$/);
    await expect(page.getByRole("navigation", { name: "Menú" })).toHaveCount(0); // se cerró al navegar
  });

  test("en compu la cabecera muestra los temas y no el botón de menú", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "solo en compu");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Principal" });
    for (const name of ["Cómo funciona", "Rubros", "Cuotas", "Precios", "Ayuda"]) await expect(nav.getByRole("link", { name })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir menú" })).toBeHidden();
  });
});

test.describe("blog, ayuda y legales", () => {
  test("el blog lista los 3 artículos y cada uno abre con su contenido, CTA y datos estructurados", async ({ page }) => {
    await page.goto("/blog");
    const links = page.locator("main li a");
    await expect(links).toHaveCount(3);
    await links.first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Creá tu página gratis" }).last()).toHaveAttribute("href", "/crear");
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    expect(ld["@type"]).toBe("Article");
    expect(ld.inLanguage).toBe("es-AR");
  });

  test("un artículo inexistente da 404", async ({ request }) => {
    expect((await request.get("/blog/no-existe")).status()).toBe(404);
    expect((await request.get("/ayuda/no-existe")).status()).toBe(404);
  });

  test("el centro de ayuda tiene sus artículos", async ({ page }) => {
    await page.goto("/ayuda");
    await expect(page.locator("main li a")).toHaveCount(6);
    await page.getByRole("link", { name: /Cómo cargar productos/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cómo cargar productos y servicios");
  });

  test("las páginas legales existen y citan la normativa argentina", async ({ page }) => {
    await page.goto("/privacidad");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de privacidad");
    await expect(page.locator("main")).toContainText("Ley 25.326");
    for (const [path, h1] of [["/terminos", "Términos y condiciones"], ["/cancelacion", "Política de cancelación"]] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
    }
  });

  test("el botón de arrepentimiento registra la solicitud y manda el acuse por email", async ({ page }, info) => {
    const mail = `arr-${info.project.name}-${Date.now()}@test.com`;
    await page.goto("/arrepentimiento");
    await page.getByLabel(/^Nombre y apellido/).fill("Ana Pérez");
    await page.getByLabel(/^Email/).fill(mail);
    await page.getByLabel(/¿Qué querés cancelar\?/).fill("Plan Emprende");
    await page.getByRole("button", { name: "Solicitar arrepentimiento" }).click();
    const done = page.getByTestId("contact-done");
    await expect(done).toContainText("Recibimos tu solicitud");
    const code = (await done.locator("strong").textContent())!;
    expect(code).toMatch(/^[0-9a-f]{8}$/);

    let text = "";
    for (let i = 0; i < 40 && !text; i++) {
      const list = await (await fetch(`http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:${mail}`)}`)).json();
      if (list.messages?.length) text = (await (await fetch(`http://localhost:8025/api/v1/message/${list.messages[0].ID}`)).json()).Text;
      else await new Promise((r) => setTimeout(r, 250));
    }
    expect(text).toContain(code);
  });

  test("el formulario de contacto valida y confirma", async ({ page }, info) => {
    await page.goto("/contacto");
    await page.getByLabel(/^Nombre y apellido/).fill("Beto");
    await page.getByLabel(/^Email/).fill("no-es-un-mail");
    await page.getByLabel(/¿En qué te ayudamos\?/).fill("Hola");
    await page.getByRole("button", { name: "Enviar consulta" }).click();
    await expect(page.locator("p[role=alert]:visible")).toContainText("Revisá el nombre y el email");
    await page.getByLabel(/^Email/).fill(`c-${info.project.name}-${Date.now()}@test.com`);
    await page.getByRole("button", { name: "Enviar consulta" }).click();
    await expect(page.getByTestId("contact-done")).toContainText("Recibimos tu consulta");
  });

  test("sitemap y robots", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/blog/que-poner-en-la-bio-de-instagram-de-tu-negocio");
    expect(sitemap).toContain("/ayuda/planes-y-pagos");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /editor");
    expect(robots).toContain("Sitemap:");
  });
});
