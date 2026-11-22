import { connection } from "next/server";
import { getSite } from "@/lib/api";
import { siteUrl } from "@/lib/siteUrl";

// La página de un negocio es una sola URL: el sitemap la lista para que Google la encuentre y la revise.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  await connection(); // por pedido: el build de Docker no tiene backend al que consultar
  const { slug } = await ctx.params;
  const site = await getSite(slug);
  if (site?.status !== "published") return new Response("Not found", { status: 404 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl(slug)}/</loc><changefreq>weekly</changefreq></url></urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
