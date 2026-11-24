import { Suspense } from "react";
import type { Metadata } from "next";
import { getTemplates } from "@/lib/api";
import { IndustryPicker } from "@/components/onboarding/IndustryPicker";
import { CrearFlow } from "@/components/onboarding/CrearFlow";
import { Glow } from "@/components/marketing/Story";

export const metadata: Metadata = {
  title: "Creá tu página gratis",
  description: "Creá tu cuenta gratis, elegí el rubro de tu negocio y arrancá con una página lista para personalizar. Sin tarjeta.",
};

async function Picker() {
  const templates = await getTemplates();
  return <IndustryPicker templates={templates} />;
}

export default function CrearPage() {
  return (
    <div className="relative isolate overflow-hidden bg-gradient-to-b from-[#FFE2D0] to-[#FFEFE6]">
      <Glow />
      <div aria-hidden className="mk-grid pointer-events-none absolute inset-0 -z-10" />
      <CrearFlow
        picker={
          <Suspense fallback={<p className="text-[#0E1B2C]/60">Cargando rubros…</p>}>
            <Picker />
          </Suspense>
        }
      />
    </div>
  );
}
