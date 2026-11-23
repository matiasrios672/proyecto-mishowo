"use client";

import { Field, Section, TextInput, Toggle } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { DAY_NAMES, isValidTime } from "@/lib/hours";
import { formatWhatsapp, isValidWhatsapp } from "@/lib/whatsapp";
import type { TabProps } from "./types";

export function NegocioTab({ draft, update }: TabProps) {
  const waError = draft.whatsapp && !isValidWhatsapp(draft.whatsapp) ? "Ingresá el código de área y el número, sin el 15. Ej: 11 5555-0000" : null;
  const mapLink = draft.address.trim() ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(draft.address)}` : null;

  return (
    <div className="space-y-8">
      <Section title="Tu negocio">
        <Field label="Nombre del negocio" required counter={{ value: draft.name, max: 60 }}>
          {(id) => (
            <TextInput id={id} value={draft.name} maxLength={60}
              onChange={(e) => update((d) => ({ ...d, name: e.target.value, nameIsExample: false }), "name")} />
          )}
        </Field>
        <Field label="WhatsApp principal" required error={waError}
          hint={draft.whatsapp && !waError ? `Los pedidos llegan a ${formatWhatsapp(draft.whatsapp)}` : "Acá te llegan los pedidos de tus clientes"}>
          {(id, desc) => (
            <TextInput id={id} aria-describedby={desc} inputMode="tel" autoComplete="tel" placeholder="11 5555-0000" value={draft.whatsapp}
              aria-invalid={!!waError} onChange={(e) => update((d) => ({ ...d, whatsapp: e.target.value }), "whatsapp")} />
          )}
        </Field>

        {draft.extraWhatsapps.map((w, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Field label={`Otro WhatsApp (${w.role})`} error={w.number && !isValidWhatsapp(w.number) ? "Revisá el número" : null}>
                {(id) => (
                  <TextInput id={id} inputMode="tel" value={w.number}
                    onChange={(e) => update((d) => ({ ...d, extraWhatsapps: d.extraWhatsapps.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)) }), `xwa${i}`)} />
                )}
              </Field>
            </div>
            <Button variant="outline" onClick={() => update((d) => ({ ...d, extraWhatsapps: d.extraWhatsapps.filter((_, j) => j !== i) }))}>Quitar</Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => update((d) => ({ ...d, extraWhatsapps: [...d.extraWhatsapps, { number: "", role: "ventas" }] }))}>
            + Otro WhatsApp de ventas
          </Button>
          <Button variant="outline" size="sm" onClick={() => update((d) => ({ ...d, extraWhatsapps: [...d.extraWhatsapps, { number: "", role: "soporte" }] }))}>
            + WhatsApp de soporte
          </Button>
        </div>

        <Field label="Instagram" hint="Tu usuario, con o sin @">
          {(id) => <TextInput id={id} placeholder="@tunegocio" value={draft.instagram} onChange={(e) => update((d) => ({ ...d, instagram: e.target.value }), "ig")} />}
        </Field>
      </Section>

      <Section title="Dónde y cómo" description="Contale a tus clientes dónde retirar o cómo coordinar la entrega.">
        <Field label="Zona de entrega o retiro" counter={{ value: draft.deliveryZone, max: 150 }}>
          {(id) => <TextInput id={id} maxLength={150} value={draft.deliveryZone} onChange={(e) => update((d) => ({ ...d, deliveryZone: e.target.value }), "zone")} />}
        </Field>
        <Field label="Dirección del local" hint="Completala solo si atendés en un local o taller">
          {(id) => <TextInput id={id} autoComplete="street-address" value={draft.address} onChange={(e) => update((d) => ({ ...d, address: e.target.value }), "address")} />}
        </Field>
        {mapLink && (
          <a href={mapLink} target="_blank" rel="noopener noreferrer" className="text-sm ">Ver la dirección en el mapa</a>
        )}
      </Section>

      <Section title="Horarios" description="Tu página va a mostrar «Abierto ahora» o «Cerrado» según el horario.">
        <ul className="space-y-2">
          {draft.hours.map((h, i) => {
            const bad = h.open && (!isValidTime(h.from) || !isValidTime(h.to));
            return (
              <li key={DAY_NAMES[i]} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 sm:grid-cols-[6.5rem_auto_1fr]">
                <Toggle checked={h.open} label={DAY_NAMES[i]!} onChange={(v) => update((d) => ({ ...d, hours: d.hours.map((x, j) => (j === i ? { ...x, open: v } : x)) }))} />
                {h.open ? (
                  <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                    <TextInput type="time" aria-label={`${DAY_NAMES[i]}: desde`} value={h.from} aria-invalid={bad}
                      onChange={(e) => update((d) => ({ ...d, hours: d.hours.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) }), `hf${i}`)} />
                    <span aria-hidden>a</span>
                    <TextInput type="time" aria-label={`${DAY_NAMES[i]}: hasta`} value={h.to} aria-invalid={bad}
                      onChange={(e) => update((d) => ({ ...d, hours: d.hours.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) }), `ht${i}`)} />
                  </div>
                ) : (
                  <span className="col-span-2 text-sm text-muted-foreground sm:col-span-1">Cerrado</span>
                )}
              </li>
            );
          })}
        </ul>
        <Button variant="outline" size="sm" onClick={() => update((d) => ({ ...d, hours: d.hours.map(() => ({ ...d.hours[0]! })) }))}>
          Copiar el horario del lunes a todos los días
        </Button>
      </Section>
    </div>
  );
}
