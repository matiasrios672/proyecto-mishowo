import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHead } from "@/components/marketing/PageHead";
import { FaqSection, FinalCta, Plans, PlansList } from "@/components/marketing/sections";
import { getSiteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Precios y preguntas frecuentes",
  description: "Empezá gratis y pasá a un plan pago cuando lo necesites. Pagás por transferencia, sin comisión por venta.",
  alternates: { canonical: "/precios" },
};

/** La FAQ visible y la de los datos estructurados son la misma (la del admin si la editó). */
async function FaqJsonLd() {
  const { faq } = await getSiteConfig();
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }} />;
}

export default function Precios() {
  return (
    <>
      <Suspense fallback={null}><FaqJsonLd /></Suspense>
      <PageHead title="Precios" lead="Empezá gratis, sin tarjeta. Pasá a un plan pago cuando tu negocio lo pida, y cambiás cuando quieras." />
      <Plans
        fallback={
          <Suspense fallback={<p className="mt-10 text-muted-foreground">Cargando planes…</p>}>
            <PlansList />
          </Suspense>
        }
      />
      <FaqSection />
      <FinalCta />
    </>
  );
}
