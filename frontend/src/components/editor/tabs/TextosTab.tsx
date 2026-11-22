"use client";

import { Field, Section, TextArea, TextInput } from "@/components/ui/fields";
import type { TabProps } from "./types";

export function TextosTab({ draft, update }: TabProps) {
  return (
    <div className="space-y-8">
      <Section title="Portada" description="Lo primero que ve tu cliente.">
        <Field label="Bajada" counter={{ value: draft.tagline, max: 200 }} hint="Una frase corta. Si la dejás vacía usamos tu descripción.">
          {(id, desc) => (
            <TextInput id={id} aria-describedby={desc} maxLength={200} value={draft.tagline}
              onChange={(e) => update((d) => ({ ...d, tagline: e.target.value, textsAreExample: false }), "tagline")} />
          )}
        </Field>
        <Field label="Descripción breve" counter={{ value: draft.description, max: 300 }} hint="Qué vendés u ofrecés, y qué te hace diferente.">
          {(id, desc) => (
            <TextArea id={id} aria-describedby={desc} rows={4} maxLength={300} value={draft.description}
              onChange={(e) => update((d) => ({ ...d, description: e.target.value, textsAreExample: false }), "description")} />
          )}
        </Field>
      </Section>
      <Section title="Aviso para tus clientes" description="Aparece como una cinta arriba de todo. Ideal para promos o cambios de horario.">
        <Field label="Texto del aviso" counter={{ value: draft.announcement, max: 120 }}>
          {(id) => (
            <TextInput id={id} maxLength={120} placeholder="Ej: Este sábado abrimos hasta las 14" value={draft.announcement}
              onChange={(e) => update((d) => ({ ...d, announcement: e.target.value }), "announcement")} />
          )}
        </Field>
      </Section>
    </div>
  );
}
