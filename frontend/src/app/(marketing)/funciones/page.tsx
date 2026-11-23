import type { Metadata } from "next";
import { PageHead } from "@/components/marketing/PageHead";
import { Bento } from "@/components/marketing/Premium";
import { FinalCta } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Todo lo que incluye",
  description: "Pedidos por WhatsApp, estadísticas sin cookies, código QR, cupones, turnos, reseñas, cuotas y aparecer en Google. Todo en tu página.",
  alternates: { canonical: "/funciones" },
};

export default function Funciones() {
  return (
    <>
      <PageHead title="Todo lo que incluye" lead="Pedidos, estadísticas, QR, cupones, turnos, reseñas y Google. Lo que trae cada página, sin letra chica." />
      <Bento />
      <FinalCta />
    </>
  );
}
