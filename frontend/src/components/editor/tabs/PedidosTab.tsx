"use client";

import { Field, Section, Select, TextArea, TextInput, Toggle } from "@/components/ui/fields";
import { formatPrice } from "@/lib/format";
import { INSTALLMENT_CHOICES, installmentLine, type Installments } from "@/lib/installments";
import type { TabProps } from "./types";

export function PedidosTab({ draft, update }: TabProps) {
  const on = draft.ordersEnabled;
  const inst = draft.installments;
  const setInst = (patch: Partial<Installments>) => update((d) => ({ ...d, installments: { ...d.installments, ...patch } }), "installments");
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

      <Section title="Cuotas sin interés" description="Mostrá en cada precio que ofrecés cuotas. Es un aviso para tus clientes: el cobro lo coordinás vos (con tu posnet, Mercado Pago o el medio que uses).">
        <div className="rounded-2xl border border-[#D6E4F2] bg-[#F4F9FE] p-4" data-testid="installments-switch">
          <Toggle checked={inst.enabled} label="Ofrecer cuotas sin interés"
            hint={inst.enabled ? "Cada producto con precio muestra «N cuotas sin interés de $X» y el carrito deja pedir pagar en cuotas." : "No se muestra ninguna cuota en tu página."}
            onChange={(v) => setInst({ enabled: v })} />
        </div>
        <fieldset disabled={!inst.enabled} className={`mt-6 space-y-6 border-0 p-0 ${inst.enabled ? "" : "opacity-50"}`}>
          <Field label="Cantidad de cuotas">
            {(id) => (
              <Select id={id} value={inst.count} onChange={(e) => setInst({ count: Number(e.target.value) })}>
                {INSTALLMENT_CHOICES.map((n) => <option key={n} value={n}>{n} cuotas</option>)}
              </Select>
            )}
          </Field>
          <Field label="Compra mínima para cuotas" hint="En pesos. Dejalo vacío para ofrecerlas en cualquier compra.">
            {(id, desc) => (
              <TextInput id={id} aria-describedby={desc} inputMode="numeric" maxLength={9} placeholder="Sin mínimo"
                value={inst.minAmount > 0 ? String(inst.minAmount) : ""}
                onChange={(e) => setInst({ minAmount: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
            )}
          </Field>
          <Field label="Aclaración (opcional)" counter={{ value: inst.note, max: 80 }} hint="Ej.: «Con tarjetas de crédito de bancos seleccionados».">
            {(id, desc) => (
              <TextInput id={id} aria-describedby={desc} maxLength={80} value={inst.note} onChange={(e) => setInst({ note: e.target.value })} />
            )}
          </Field>
          {inst.enabled && (
            <p className="rounded-xl bg-muted/60 p-3 text-sm" data-testid="installments-example">
              Ejemplo: un producto de {formatPrice(60000)} se muestra como «{installmentLine(60000, { ...inst, minAmount: 0 })}».
            </p>
          )}
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
