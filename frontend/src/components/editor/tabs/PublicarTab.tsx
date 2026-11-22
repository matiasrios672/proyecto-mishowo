"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Section, TextInput } from "@/components/ui/fields";
import { api } from "@/lib/authClient";
import { quality } from "@/lib/score";
import { fetchServerBusiness, type ServerBusiness } from "@/lib/serverSync";
import { siteHost, siteUrl, suggestSlug } from "@/lib/siteUrl";
import type { TabProps } from "./types";

const REASONS: Record<string, string> = {
  formato: "Usá entre 2 y 30 letras, números o guiones, sin espacios ni tildes.",
  reservado: "Ese link está reservado. Probá con otro.",
  prohibido: "Ese link no está permitido.",
  ocupado: "Ya está en uso. Probá con otro.",
};
const MISSING: Record<string, string> = { name: "el nombre de tu negocio", whatsapp: "tu WhatsApp", products: "al menos un producto o servicio tuyo" };

type Check = { kind: "idle" } | { kind: "checking" } | { kind: "ok" } | { kind: "bad"; reason: string };

function publishError(code: string | undefined, data: Record<string, unknown>): string {
  switch (code) {
    case "not_ready": return `Todavía falta ${(data.missing as string[]).map((m) => MISSING[m] ?? m).join(", ")}.`;
    case "email_not_verified": return "Confirmá tu email para publicar. Te mandamos un enlace a tu casilla.";
    case "invalid_slug": return REASONS[String(data.reason)] ?? REASONS.formato!;
    case "slug_taken": return REASONS.ocupado!;
    case "plan_limit": return `Tu plan permite hasta ${data.limit} productos y tenés ${data.count}. Sacá algunos o cambiá de plan.`;
    case "suspended": return "Tu página está suspendida. Escribinos desde la página de contacto para resolverlo.";
    case "network": return "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.";
    default: return "No pudimos publicar tu página. Probá de nuevo en un momento.";
  }
}

export function PublicarTab({ draft, goTab, account }: TabProps) {
  const q = quality(draft);
  const pending = q.items.filter((i) => !i.done);
  const done = q.items.filter((i) => i.done);

  const [biz, setBiz] = useState<ServerBusiness | null | undefined>(undefined);
  const [slug, setSlug] = useState(() => suggestSlug(draft.name));
  const [check, setCheck] = useState<Check>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [changing, setChanging] = useState(false);
  const enabled = !!account?.enabled;
  const published = biz?.status === "published";

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchServerBusiness().then((r) => {
      if (!alive || r.kind !== "ok") return;
      setBiz(r.business);
      if (r.business?.status === "published") setSlug(r.business.slug);
    });
    return () => { alive = false; };
  }, [enabled]);

  // ¿Está libre el link? Se consulta con una pausa para no preguntar en cada letra.
  useEffect(() => {
    if (!enabled || slug.length === 0) return;
    let alive = true;
    const t = setTimeout(async () => {
      if (alive) setCheck({ kind: "checking" });
      const r = await api<{ available: boolean; reason?: string }>(`/me/slug?slug=${encodeURIComponent(slug)}`);
      if (!alive) return;
      setCheck(r.ok && r.data.available ? { kind: "ok" } : { kind: "bad", reason: r.data.reason ?? "formato" });
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [slug, enabled]);

  async function publish() {
    setBusy(true);
    setError(null);
    await account?.settle(); // lo último que escribiste tiene que estar en el servidor antes de publicar
    const r = await api<Record<string, unknown>>("/me/business/publish", { body: { slug } });
    setBusy(false);
    if (!r.ok) return setError(publishError(r.data.error as string | undefined, r.data));
    const fresh = await fetchServerBusiness();
    if (fresh.kind === "ok") setBiz(fresh.business);
    setChanging(false);
  }

  async function unpublish() {
    setBusy(true);
    setError(null);
    const r = await api("/me/business/unpublish", { body: {} });
    setBusy(false);
    if (!r.ok) return setError(publishError(r.data.error, r.data));
    const fresh = await fetchServerBusiness();
    if (fresh.kind === "ok") setBiz(fresh.business);
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* sin permiso para el portapapeles */ }
  }

  const checkHint = check.kind === "checking" ? "Buscando si está libre…" : check.kind === "ok" ? "✓ Está libre" : undefined;

  return (
    <div className="space-y-6">
      <Section title="Antes de publicar">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <p className="font-medium" data-testid="score-text">Tu página está al {q.score}%</p>
            <p className="text-xs text-muted-foreground">{done.length} de {q.items.length} listo</p>
          </div>
          <div role="progressbar" aria-label="Calidad de tu página" aria-valuemin={0} aria-valuemax={100} aria-valuenow={q.score} className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${q.score}%` }} />
          </div>
          {q.tip && <p className="mt-2 text-sm text-muted-foreground">Próximo paso: {q.tip}</p>}
        </div>

        {pending.length > 0 && (
          <ul className="space-y-2" aria-label="Pendientes">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm">
                  {i.label}
                  {i.required && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Obligatorio</span>}
                </span>
                <Button size="sm" variant="outline" onClick={() => goTab(i.tab)}>Completar</Button>
              </li>
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <ul className="space-y-1 text-sm text-muted-foreground" aria-label="Completados">
            {done.map((i) => <li key={i.id}><span aria-hidden>✓ </span>{i.doneLabel}</li>)}
          </ul>
        )}
      </Section>

      <Section title="Publicar">
        {!enabled && (
          <>
            <Button size="lg" disabled className="w-full" aria-describedby="pub-note">Publicar mi página</Button>
            <p id="pub-note" className="text-sm text-muted-foreground">
              Para publicar tu página necesitás una cuenta gratis.{" "}
              <Link href="/registro?next=/editor" className="font-medium underline underline-offset-4">Crear mi cuenta</Link>
            </p>
          </>
        )}

        {enabled && published && biz && !changing && (
          <div className="space-y-3 rounded-xl border-2 border-primary p-4" data-testid="published-box">
            <p className="font-semibold">¡Tu página está publicada!</p>
            <a href={siteUrl(biz.slug)} target="_blank" rel="noopener noreferrer" className="block break-all text-lg font-medium underline underline-offset-4" data-testid="published-link">
              {siteHost(biz.slug)}
            </a>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copy(siteUrl(biz.slug))}>{copied ? "¡Copiado!" : "Copiar link"}</Button>
              <Button size="sm" variant="outline" render={<a href={siteUrl(biz.slug)} target="_blank" rel="noopener noreferrer" />}>Ver mi página</Button>
              <Button size="sm" variant="outline" onClick={() => { setChanging(true); setCheck({ kind: "idle" }); }}>Cambiar el link</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={unpublish}>Despublicar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Los cambios que hagas en el editor se ven en tu página al instante.</p>
          </div>
        )}

        {enabled && (!published || changing) && (
          <>
            <Field
              label="El link de tu página"
              error={check.kind === "bad" ? REASONS[check.reason] ?? REASONS.formato : null}
              hint={checkHint ?? "Es la dirección que vas a compartir con tus clientes"}
            >
              {(id, desc) => (
                <div className="flex items-center gap-2">
                  <TextInput id={id} aria-describedby={desc} value={slug} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    onChange={(e) => { setSlug(e.target.value.toLowerCase()); setCheck({ kind: "idle" }); setError(null); }} />
                  <span className="shrink-0 text-sm text-muted-foreground">.{siteHost("x").split(".").slice(1).join(".")}</span>
                </div>
              )}
            </Field>
            {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="lg" disabled={busy || slug.length === 0 || check.kind === "bad" || check.kind === "checking"} onClick={publish} data-testid="publish-button">
                {busy ? "Publicando…" : changing ? "Guardar el nuevo link" : "Publicar mi página"}
              </Button>
              {changing && <Button size="lg" variant="ghost" onClick={() => { setChanging(false); setError(null); if (biz) setSlug(biz.slug); }}>Cancelar</Button>}
            </div>
            {!q.canPublish && (
              <p className="text-sm text-muted-foreground">
                Te falta completar {q.missingRequired.length} paso{q.missingRequired.length === 1 ? "" : "s"} obligatorio{q.missingRequired.length === 1 ? "" : "s"} para poder publicar.
              </p>
            )}
          </>
        )}
        {enabled && error && published && !changing && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      </Section>
    </div>
  );
}
