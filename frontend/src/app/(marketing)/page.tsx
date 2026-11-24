import { Suspense } from "react";
import type { Metadata } from "next";
import { FaqSection, FinalCta, Hero, Plans, PlansList } from "@/components/marketing/sections";
import { RubroStage } from "@/components/marketing/RubroStage";
import { ScrollFx } from "@/components/marketing/ScrollFx";
import { Contrast, Improving } from "@/components/marketing/Pitch";

export const metadata: Metadata = {
  title: { absolute: "MiShowo: creá la página de tu negocio desde el celular" },
  description: "Armá la página de tu negocio en minutos: tu carta, catálogo o servicios online, con pedidos por WhatsApp si querés y un link listo para tu bio de Instagram. Empezá gratis.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "MiShowo: tu negocio, siempre abierto",
    description: "Carta, catálogo o servicios, pedidos por WhatsApp si querés y tu link para Instagram. Empezá gratis.",
    type: "website", locale: "es_AR", siteName: "MiShowo", images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", name: "MiShowo", url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://mishowo.com" },
    { "@type": "SoftwareApplication", name: "MiShowo", applicationCategory: "BusinessApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "ARS" } },
  ],
};

/** Home corta: el mensaje, los rubros (con su ejemplo), los planes y un menú para elegir qué ver. Cada tema vive en su página. */
export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ScrollFx />
      <Hero />
      <Contrast />
      <RubroStage />
      <Plans
        fallback={
          <Suspense fallback={<p className="mt-10 text-muted-foreground">Cargando planes…</p>}>
            <PlansList />
          </Suspense>
        }
      />
      <Improving />
      <FaqSection limit={5} />
      <FinalCta />
    </>
  );
}
