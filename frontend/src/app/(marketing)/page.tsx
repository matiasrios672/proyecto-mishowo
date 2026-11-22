import { Suspense } from "react";
import type { Metadata } from "next";
import {
  Benefits, DemoSection, Examples, FAQ, FaqSection, FinalCta, Hero, Plans, PlansList, Soon, Testimonials,
} from "@/components/marketing/sections";
import { Compare, RubrosMarquee, Story, TrustStrip } from "@/components/marketing/Story";

export const metadata: Metadata = {
  title: { absolute: "MiShowo: creá la página de tu negocio desde el celular" },
  description: "Armá la página de tu negocio en minutos: catálogo, pedidos por WhatsApp y un link listo para tu bio de Instagram. Empezá gratis.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "MiShowo: tu negocio, en un link",
    description: "Catálogo, pedidos por WhatsApp y tu link para Instagram. Empezá gratis.",
    type: "website", locale: "es_AR", siteName: "MiShowo", images: ["/video/poster.jpg"],
  },
};

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "MiShowo", url: "https://mishowo.com" },
      { "@type": "SoftwareApplication", name: "MiShowo", applicationCategory: "BusinessApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "ARS" } },
      { "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero />
      <TrustStrip />
      <RubrosMarquee />
      <DemoSection />
      <Story />
      <Compare />
      <Examples />
      <Benefits />
      <Plans
        fallback={
          <Suspense fallback={<p className="mt-10 text-muted-foreground">Cargando planes…</p>}>
            <PlansList />
          </Suspense>
        }
      />
      <Testimonials />
      <FaqSection />
      <Soon />
      <FinalCta />
    </>
  );
}
