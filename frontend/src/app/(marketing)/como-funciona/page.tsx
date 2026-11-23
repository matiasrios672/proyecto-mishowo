import type { Metadata } from "next";
import { PageHead } from "@/components/marketing/PageHead";
import { ExplainerSection } from "@/components/marketing/Premium";
import { FinalCta } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Cómo funciona",
  description: "Creá la página de tu negocio en tres pasos, desde el celular: elegís tu rubro, cargás lo tuyo y compartís el link.",
  alternates: { canonical: "/como-funciona" },
};

export default function ComoFunciona() {
  return (
    <>
      <PageHead title="Cómo funciona" lead="De la idea a tu link en tres pasos. Todo desde el celular, sin instalar nada y sin saber de diseño." />
      <ExplainerSection />
      <FinalCta />
    </>
  );
}
