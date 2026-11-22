"use client";

import { Section } from "@/components/ui/fields";

export function FotosTab() {
  return (
    <Section title="Fotos y videos" description="Las fotos hacen que vendas más.">
      <div className="rounded-xl border border-dashed p-5 text-sm">
        <p className="font-medium">Para subir fotos necesitás una cuenta.</p>
        <p className="mt-1 text-muted-foreground">
          Podés armar todo tu catálogo sin cuenta. Cuando guardes tu página, vas a poder subir fotos y videos (JPG, PNG o WebP de hasta 10 MB) de tu portada y de cada producto.
        </p>
      </div>
    </Section>
  );
}
