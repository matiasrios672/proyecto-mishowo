/* eslint-disable @next/next/no-img-element -- las imágenes generadas (OG) no pasan por next/image */
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { getSite } from "@/lib/api";
import { publicToSite } from "@/lib/site";
import { siteUrl } from "@/lib/siteUrl";
import { brandDataUri } from "@/lib/brandAssets";

/** Imagen para compartir de un negocio sin fotos (WhatsApp, Instagram, Facebook): nombre, rubro y su link, con el color de su marca. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await ctx.params;
  const site = await getSite(slug);
  if (!site?.business) return new Response("Not found", { status: 404 });
  const m = publicToSite(site);
  const brand = /^#[0-9a-f]{6}$/i.test(m.design.brandColor ?? "") ? (m.design.brandColor as string) : "#C73E00";
  const display = siteUrl(slug).replace(/^https?:\/\//, "");
  const iso = await brandDataUri("isotipo.png");
  const name = m.name.length > 44 ? `${m.name.slice(0, 43)}…` : m.name;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: `linear-gradient(135deg, ${brand} 0%, #0E1B2C 120%)`, color: "#fff" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, opacity: 0.85 }}>Catálogo y pedidos por WhatsApp</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: name.length > 24 ? 84 : 112, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{name}</div>
          {m.tagline ? <div style={{ display: "flex", marginTop: 24, fontSize: 38, opacity: 0.9 }}>{m.tagline.slice(0, 90)}</div> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", padding: "16px 32px", borderRadius: 999, background: "#F6B40E", color: "#0E1B2C", fontSize: 38, fontWeight: 800 }}>{display}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, opacity: 0.9 }}>{iso ? <img src={iso} alt="" width={44} height={44} /> : null}Hecho por MiShowo</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}
