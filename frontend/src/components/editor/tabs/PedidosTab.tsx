"use client";

import { Field, Section, TextArea, Toggle } from "@/components/ui/fields";
import type { TabProps } from "./types";

export function PedidosTab({ draft, update }: TabProps) {
  const on = draft.ordersEnabled;
  return (
    <div className="space-y-8">
      <Section title="Pedidos" description="Elegí cómo te contactan tus clientes.">
        <div className="rounded-2xl border border-[#D6E4F2] bg-[#F4F9FE] p-4" data-testid="orders-switch">
          <Toggle checked={on} label="Recibir pedidos en mi página"
            hint={on
              ? "Tus clientes arman el pedido en la página y te llega por WhatsApp con todo escrito."
              : "Tu página muestra el catálogo y un botón para consultar por WhatsApp. No hay carrito ni pedidos."}
            onChange={(v) => update((d) => ({ ...d, ordersEnabled: v }))} />
        </div>
      </Section>

      <Section title="Cómo llegan los pedidos" description={on ? "Estos ajustes aplican al carrito de tu página." : undefined}>
        {!on && (
          <p role="status" className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground" data-testid="orders-off-note">
            Activá «Recibir pedidos en mi página» para usar estas opciones. Mientras tanto, cada producto muestra un botón «Consultar» que abre WhatsApp.
          </p>
        )}
        <fieldset disabled={!on} className={`space-y-6 border-0 p-0 ${on ? "" : "opacity-50"}`}>
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
        </fieldset>
      </Section>

      <Section title="Cupones y turnos">
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Los cupones de descuento se administran desde tu panel (Cupones) y funcionan solo si recibís pedidos. Los turnos se activan desde Turnos.
        </p>
      </Section>
    </div>
  );
}
