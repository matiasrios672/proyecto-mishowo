import type { Metadata } from "next";
import { PageHead } from "@/components/marketing/PageHead";
import { DemoSection, FinalCta } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Probalo vos mismo",
  description: "Cambiá el nombre, el rubro y el estilo de una página de ejemplo y mirala en vivo, antes de crear tu cuenta.",
  alternates: { canonical: "/probar" },
};

export default function Probar() {
  return (
    <>
      <PageHead title="Probalo vos mismo" lead="Cambiá el nombre, el rubro y los colores y mirá cómo queda tu página, antes de crear tu cuenta." />
      <DemoSection />
      <FinalCta />
    </>
  );
}
