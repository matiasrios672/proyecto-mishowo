import type { Metadata } from "next";
import { PageHead } from "@/components/marketing/PageHead";
import { RubroShowcase } from "@/components/marketing/Rubros";
import { BarsSection } from "@/components/marketing/Premium";
import { Examples, FinalCta } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Para tu rubro",
  description: "Páginas para tiendas de ropa, rotiserías, bares, eventos, muebles, belleza y más. Elegí tu rubro y arrancás con una página armada.",
  alternates: { canonical: "/rubros" },
};

export default function Rubros() {
  return (
    <>
      <PageHead title="Una página para cada rubro" lead="Ropa, comidas, bares, eventos, muebles, belleza y más. Elegís el tuyo y arrancás con una página ya armada." />
      <RubroShowcase />
      <BarsSection />
      <Examples />
      <FinalCta />
    </>
  );
}
