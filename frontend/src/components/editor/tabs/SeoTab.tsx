"use client";

import { Section } from "@/components/ui/fields";
import type { TabProps } from "./types";
import { MedicionSection } from "./MedicionSection";

export function SeoTab({ draft, update, account }: TabProps) {
  const title = draft.name.trim() || "Tu negocio";
  const desc = (draft.tagline || draft.description).trim();
  return (
    <div className="space-y-6">
      <Section title="Cómo se ve tu link" description="Así aparece tu página cuando la compartís por WhatsApp o aparece en Google.">
        <div className="rounded-xl border p-4" data-testid="share-preview">
          <p className="text-xs text-muted-foreground">tunegocio.mishowo.com</p>
          <p className="mt-1 text-lg font-medium text-primary">{title}</p>
          <p className="text-sm text-muted-foreground">{desc.slice(0, 160) || "Agregá una descripción para que aparezca acá."}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Usamos el nombre y la bajada de tu página. Cuando la publiques, además vas a poder descargar el QR para el mostrador y las bolsas.
        </p>
      </Section>
      <MedicionSection draft={draft} update={update} account={account} />
    </div>
  );
}
