import { Suspense } from "react";
import type { Metadata } from "next";
import { getTemplates } from "@/lib/api";
import { IndustryPicker } from "@/components/onboarding/IndustryPicker";
import { Wordmark } from "@/components/brand/Wordmark";

export const metadata: Metadata = {
  title: "Creá tu página",
  description: "Elegí el rubro de tu negocio y arrancá con una página lista para personalizar.",
};

async function Picker() {
  const templates = await getTemplates();
  return <IndustryPicker templates={templates} />;
}

export default function CrearPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Wordmark />
      <h1 className="mt-6 text-3xl font-bold tracking-tight">¿De qué es tu negocio?</h1>
      <p className="mt-2 mb-6 text-muted-foreground">
        Elegí un rubro y te armamos una página de ejemplo. Después cambiás todo a tu gusto, sin crear cuenta.
      </p>
      <Suspense fallback={<p className="text-muted-foreground">Cargando rubros…</p>}>
        <Picker />
      </Suspense>
    </main>
  );
}
