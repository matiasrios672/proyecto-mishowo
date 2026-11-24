/* eslint-disable @next/next/no-img-element -- las imágenes generadas (OG) no pasan por next/image */
import { ImageResponse } from "next/og";
import { brandDataUri } from "@/lib/brandAssets";

export const alt = "MiShowo: tu negocio, en un link";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen por defecto al compartir MiShowo (landing, blog y ayuda) en WhatsApp, Instagram o Facebook. */
export default async function OpengraphImage() {
  const logo = await brandDataUri("logo.png");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#FFE2D0 0%,#FFFBF8 55%,#FAC9A8 100%)", color: "#0E1B2C" }}>
        <div style={{ display: "flex", fontSize: 54, fontWeight: 800 }}>{logo ? <img src={logo} alt="MiShowo" height={64} width={373} /> : <>Mi<span style={{ color: "#C73E00" }}>Showo</span></>}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 108, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>Tu negocio,</div>
          <div style={{ display: "flex", fontSize: 108, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, color: "#FC5502" }}>en un link.</div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 38, color: "#47566A" }}>Catálogo, pedidos por WhatsApp y link para Instagram.</div>
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", padding: "16px 36px", borderRadius: 999, background: "#15803D", color: "#fff", fontSize: 38, fontWeight: 800 }}>Empezá gratis · mishowo.com</div>
        </div>
      </div>
    ),
    size,
  );
}
