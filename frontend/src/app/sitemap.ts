import type { MetadataRoute } from "next";
import { BLOG } from "@/content/blog";
import { HELP } from "@/content/help";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/como-funciona", "/rubros", "/cuotas", "/funciones", "/precios", "/probar", "/crear", "/blog", "/ayuda", "/contacto", "/terminos", "/privacidad", "/cancelacion", "/arrepentimiento"];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...BLOG.map((a) => ({ url: `${base}/blog/${a.slug}`, lastModified: a.date, priority: 0.7 })),
    ...HELP.map((h) => ({ url: `${base}/ayuda/${h.slug}`, priority: 0.5 })),
  ];
}
