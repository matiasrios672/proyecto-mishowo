"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Field, Section, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import type { TabProps } from "./types";

const META = /^\d{8,20}$/;
const GA = /^G-[A-Z0-9]{6,14}$/;

/** IDs del Pixel de Meta y de Google Analytics 4. Solo se activan en los planes que incluyen el módulo. */
export function MedicionSection({ draft, update, account }: Pick<TabProps, "draft" | "update" | "account">) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!account?.enabled) return;
    let alive = true;
    api<{ current: { modules?: Record<string, boolean> } }>("/me/plan").then((r) => { if (alive) setAllowed(r.ok ? r.data.current.modules?.pixels === true : false); });
    return () => { alive = false; };
  }, [account?.enabled]);

  const off = !account?.enabled || allowed === false;
  const metaBad = draft.metaPixelId !== "" && !META.test(draft.metaPixelId);
  const gaBad = draft.gaId !== "" && !GA.test(draft.gaId);
  return (
    <Section title="Medición de campañas" description="Conectá el Pixel de Meta y Google Analytics para medir tus anuncios y retargetear a quienes visitan tu página.">
      {off && (
        <p role="status" className="border border-dashed p-4 text-sm text-muted-foreground" data-testid="pixels-locked">
          {account?.enabled ? <>Tu plan actual no incluye la medición de campañas. <Link href="/panel/plan" className="font-semibold text-[#C73E00]">Ver planes</Link></> : "Creá tu cuenta para conectar tus pixeles."}
        </p>
      )}
      <fieldset disabled={off} className={`grid gap-4 border-0 p-0 sm:grid-cols-2 ${off ? "opacity-50" : ""}`}>
        <Field label="ID del Pixel de Meta" hint="Solo números (15 o 16 dígitos). Lo ves en el Administrador de eventos de Meta." error={metaBad ? "Tiene que ser solo números, de 8 a 20 dígitos." : null}>
          {(id, d) => <TextInput id={id} aria-describedby={d} inputMode="numeric" maxLength={20} value={draft.metaPixelId} placeholder="123456789012345" onChange={(e) => update((x) => ({ ...x, metaPixelId: e.target.value.replace(/\D/g, "") }), "meta")} />}
        </Field>
        <Field label="ID de Google Analytics 4" hint="Empieza con G- (por ejemplo G-AB12CD34EF)." error={gaBad ? "Tiene que tener el formato G-XXXXXXXXXX." : null}>
          {(id, d) => <TextInput id={id} aria-describedby={d} maxLength={16} value={draft.gaId} placeholder="G-AB12CD34EF" onChange={(e) => update((x) => ({ ...x, gaId: e.target.value.toUpperCase().replace(/\s/g, "") }), "ga")} />}
        </Field>
      </fieldset>
      <p className="text-xs text-muted-foreground">Estos servicios guardan cookies en el navegador de tus visitantes: mencionalo en tu política de privacidad.</p>
    </Section>
  );
}
