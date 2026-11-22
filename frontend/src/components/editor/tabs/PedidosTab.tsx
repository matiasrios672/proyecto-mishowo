"use client";

import { Field, Section, TextArea, Toggle } from "@/components/ui/fields";
import type { TabProps } from "./types";

export function PedidosTab({ draft, update }: TabProps) {
  return (
    <div className="space-y-8">
      <Section title="Pedidos por WhatsApp" description="Tu cliente arma el pedido en la página y se abre WhatsApp con todo escrito.">
        <Field label="Mensaje inicial" counter={{ value: draft.whatsappGreeting, max: 200 }} hint="Es la primera línea del mensaje que te llega.">
          {(id, desc) => (
            <TextArea id={id} aria-describedby={desc} maxLength={200} value={draft.whatsappGreeting}
              onChange={(e) => update((d) => ({ ...d, whatsappGreeting: e.target.value }), "greeting")} />
          )}
        </Field>
        <Toggle checked={draft.showQuantities} label="Mostrar cantidades" hint="El cliente elige cuántas unidades pide de cada producto."
          onChange={(v) => update((d) => ({ ...d, showQuantities: v }))} />
        <Toggle checked={draft.askEventDate} label="Pedir fecha del evento" hint="Agrega un calendario al pedido. Útil para alquileres y eventos."
          onChange={(v) => update((d) => ({ ...d, askEventDate: v }))} />
      </Section>
      <Section title="Cupones y turnos">
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Cupones de descuento y turnos con calendario van a estar disponibles en las próximas semanas.
        </p>
      </Section>
    </div>
  );
}
