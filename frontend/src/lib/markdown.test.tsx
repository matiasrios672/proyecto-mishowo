import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown, safeHref } from "./markdown";
import { BLOG } from "@/content/blog";
import { HELP } from "@/content/help";
import { LEGAL } from "@/content/legal";

const html = (md: string) => renderToStaticMarkup(<Markdown source={md} />);

describe("Markdown", () => {
  it("renderiza títulos, párrafos, listas y énfasis", () => {
    const out = html("# Título\n\nUn párrafo con **negrita** y *cursiva*.\n\n- uno\n- dos\n\n1. primero\n2. segundo");
    expect(out).toContain("<h2");
    expect(out).toContain("<strong>negrita</strong>");
    expect(out).toContain("<em>cursiva</em>");
    expect(out).toContain("<ul");
    expect(out).toContain("<ol");
    expect(out.match(/<li>/g)).toHaveLength(4);
  });

  it("escapa el HTML crudo: nunca se ejecuta", () => {
    const out = html("Hola <script>alert(1)</script> <img src=x onerror=alert(1)>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });

  it("solo permite links internos o https", () => {
    expect(safeHref("/crear")).toBe("/crear");
    expect(safeHref("https://mishowo.com")).toBe("https://mishowo.com");
    for (const bad of ["javascript:alert(1)", "//evil.com", "http://inseguro.com", "data:text/html,x", "mailto:a@b.com", "evil.com"]) expect(safeHref(bad), bad).toBeNull();
  });

  it("un link peligroso queda como texto, sin <a>", () => {
    const out = html("[tocá acá](javascript:alert(1))");
    expect(out).not.toContain("<a");
    expect(out).not.toContain("javascript");
    expect(out).toContain("tocá acá");
  });

  it("los links externos abren sin pasar el control de la página", () => {
    expect(html("[sitio](https://ejemplo.com)")).toContain('rel="noopener noreferrer"');
  });
});

describe("contenido", () => {
  it("el blog tiene 3 artículos semilla con slugs únicos, descripciones y cuerpo", () => {
    expect(BLOG).toHaveLength(3);
    expect(new Set(BLOG.map((a) => a.slug)).size).toBe(3);
    for (const a of BLOG) {
      expect(a.description.length).toBeGreaterThan(40);
      expect(a.description.length).toBeLessThanOrEqual(170);
      expect(a.body.length).toBeGreaterThan(500);
      expect(html(a.body)).toContain("<h2");
    }
  });
  it("todo link interno de los contenidos apunta a una ruta que existe", () => {
    const ok = new Set(["/crear", "/registro", "/ingresar", "/recuperar", "/ayuda", "/blog", "/contacto", "/terminos", "/privacidad", "/cancelacion", "/arrepentimiento", "/planes"]);
    for (const text of [...BLOG, ...HELP, ...LEGAL].map((d) => d.body))
      for (const m of text.matchAll(/\]\((\/[^)\s#]*)\)/g)) expect(ok.has(m[1]!), m[1]).toBe(true);
  });
  it("los textos legales citan la Ley 25.326 y los 10 días de arrepentimiento", () => {
    expect(LEGAL.find((d) => d.slug === "privacidad")!.body).toContain("25.326");
    expect(LEGAL.find((d) => d.slug === "cancelacion")!.body).toContain("10 días");
  });
});
