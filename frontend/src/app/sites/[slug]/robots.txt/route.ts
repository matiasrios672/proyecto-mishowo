import { connection } from "next/server";
import { getSite } from "@/lib/api";
import { siteUrl } from "@/lib/siteUrl";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  await connection(); // por pedido: el build de Docker no tiene backend al que consultar
  const { slug } = await ctx.params;
  const site = await getSite(slug);
  if (site?.status !== "published") return new Response("Not found", { status: 404 });
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${siteUrl(slug)}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
