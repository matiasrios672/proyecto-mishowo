"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/components/auth/authStore";
import { api } from "@/lib/authClient";
import { contentToDraft, type DraftContent } from "@/lib/draft";
import { buildChecklist, quality, type ChecklistItem } from "@/lib/score";
import { MODULE_ROUTE, moduleOf } from "@/lib/modules";
import { siteUrl } from "@/lib/siteUrl";
import { IconArrowRight } from "@/components/marketing/Icons2";
import { IconBag, IconChart, IconCheck, IconQr, IconStore, IconTag } from "@/components/marketing/Doodles";

interface Biz { business: { slug: string; status: string } | null; content: DraftContent | null }
interface Stats { totals: { visits: number; whatsappClicks: number; orders: number } }

const greeting = () => { const h = new Date().getHours(); return h < 6 ? "¡Buenas noches" : h < 13 ? "¡Buen día" : h < 20 ? "¡Buenas tardes" : "¡Buenas noches"; };

/** El link del negocio a mano: copiarlo o mandarlo por WhatsApp. Sin publicar, lleva a Publicar. */
function LinkCard({ slug, published }: { slug: string; published: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = siteUrl(slug);
  const shown = url.replace(/^https?:\/\//, "");
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sin permiso del portapapeles: el link está a la vista para copiarlo a mano */ }
  }
  if (!published)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-dashed border-[#D5D9E2] bg-white/60 p-5" data-testid="home-link">
        <p className="text-sm"><strong>Tu link todavía no está activo.</strong> Publicá tu página para compartirlo en Instagram y WhatsApp.</p>
        <Link href="/panel/pagina?tab=publicar" className="inline-flex min-h-11 items-center rounded-xl bg-[#FC5502] px-5 font-bold text-[#0E1B2C]">Publicar</Link>
      </div>
    );
  return (
    <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-3xl border border-[#E5E8EF] bg-gradient-to-br from-white via-white to-[#FFF1E8] p-5 sm:p-6" data-testid="home-link">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">Tu link para compartir</p>
        <p className="truncate text-xl font-extrabold tracking-tight text-[#151B2B]">{shown}</p>
      </div>
      <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center rounded-xl bg-[#FC5502] px-5 font-bold text-[#0E1B2C] hover:bg-[#E04C00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{copied ? "¡Copiado!" : "Copiar link"}</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(`Mirá mi catálogo: ${url}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-[#D5D9E2] bg-white px-5 font-semibold text-[#151B2B] shadow-sm hover:border-[#FC5502]">Mandar por WhatsApp</a>
    </div>
  );
}

interface Referral { code: string; link: string; invited: number; withPage: number; published: number; paid: number }

/** Invitar a otras personas: el link propio y cuántas se sumaron. */
function ReferralCard() {
  const [r, setR] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    api<Referral>("/me/referral").then((x) => { if (alive && x.ok) setR(x.data); });
    return () => { alive = false; };
  }, []);
  if (!r) return null;
  async function copy() {
    try { await navigator.clipboard.writeText(r!.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* el link está a la vista para copiarlo a mano */ }
  }
  return (
    <div className="rounded-3xl border border-[#E5E8EF] bg-white p-5 sm:p-6" data-testid="home-referral">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">Invitá a otros emprendedores</p>
          <p className="text-sm text-muted-foreground">Compartí tu link: cuando alguien crea su página desde ahí, lo vas a ver acá.</p>
          <p className="mt-1 truncate text-sm font-semibold text-[#C73E00]">{r.link.replace(/^https?:\/\//, "")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copy()} className="inline-flex min-h-10 items-center rounded-xl border border-[#D5D9E2] px-4 text-sm font-semibold hover:border-[#FC5502]">{copied ? "¡Copiado!" : "Copiar link"}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Armé la página de mi negocio con MiShowo, es gratis: ${r.link}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-xl border border-[#D5D9E2] px-4 text-sm font-semibold hover:border-[#FC5502]">Mandar por WhatsApp</a>
        </div>
      </div>
      {r.invited > 0 && <p className="mt-3 text-sm"><strong>{r.invited}</strong> {r.invited === 1 ? "persona se sumó" : "personas se sumaron"} · {r.published} {r.published === 1 ? "publicó" : "publicaron"} su página</p>}
    </div>
  );
}

/** Inicio del panel: cómo viene el negocio esta semana y qué falta para tener la página lista. */
export function HomePanel() {
  const user = useUser();
  const [biz, setBiz] = useState<Biz | null | undefined>(undefined);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    api<Biz>("/me/business").then((r) => { if (alive) setBiz(r.ok ? r.data : null); });
    api<Stats>("/me/stats?days=7").then((r) => { if (alive && r.ok) setStats(r.data); });
    return () => { alive = false; };
  }, []);

  if (biz === undefined) return <p className="text-muted-foreground">Cargando…</p>;
  if (!biz?.business || !biz.content)
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Armá tu primera página</h1>
        <p className="max-w-[56ch] text-muted-foreground">Elegí tu rubro y en minutos tenés un catálogo listo para compartir.</p>
        <Link href="/crear" className="inline-flex min-h-11 items-center rounded-xl bg-[#FC5502] px-6 font-bold text-[#0E1B2C]">Empezar</Link>
      </section>
    );

  const draft = contentToDraft(biz.content);
  const q = quality(draft);
  const pending: ChecklistItem[] = buildChecklist(draft).filter((i) => !i.done);
  const published = biz.business.status === "published";
  const name = user?.name?.split(" ")[0];
  const ordersOn = biz.content.ordersEnabled !== false;
  const tiles: [string, string][] = [["Visitas (7 días)", String(stats?.totals.visits ?? "–")], ["Clics a WhatsApp", String(stats?.totals.whatsappClicks ?? "–")], ...(ordersOn ? [["Pedidos", String(stats?.totals.orders ?? "–")] as [string, string]] : [])];
  const actions = [
    { href: MODULE_ROUTE.catalogo, label: "Agregar un producto", Icon: IconBag },
    ...(ordersOn ? [{ href: "/panel/cupones", label: "Crear un cupón", Icon: IconTag }] : []),
    { href: "/panel/qr", label: "Imprimir mi QR", Icon: IconQr },
    { href: "/panel/estadisticas", label: "Ver estadísticas", Icon: IconChart },
  ];

  return (
    <section aria-labelledby="home-title" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-1">
        <div>
          <h1 id="home-title">{greeting()}{name ? `, ${name}` : ""}!</h1>
          <p className="mt-2 flex items-center gap-2 text-muted-foreground"><span className={`inline-block size-2 rounded-full ${published ? "bg-emerald-500" : "bg-amber-400"}`} aria-hidden />{draft.name}: {published ? "tu página está publicada" : "tu página todavía no está publicada"}</p>
        </div>
        {published && <a href={siteUrl(biz.business.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D5D9E2] bg-white px-4 font-semibold shadow-sm hover:border-[#FC5502]"><IconStore className="size-5 text-[#C73E00]" />Ver mi página</a>}
      </div>

      <LinkCard slug={biz.business.slug} published={published} />

      <dl className={`grid gap-2.5 sm:gap-4 ${tiles.length === 2 ? "grid-cols-2" : "grid-cols-3"}`} data-testid="home-stats">
        {tiles.map(([label, value]) => <div key={label} className="rounded-3xl border border-[#E5E8EF] bg-white p-3.5 shadow-[0_1px_2px_rgba(21,27,43,0.04),0_22px_40px_-30px_rgba(21,27,43,0.3)] sm:p-5"><dt className="text-xs font-medium leading-tight text-muted-foreground sm:text-sm">{label}</dt><dd className="mt-2 text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight text-[#151B2B]">{value}</dd></div>)}
      </dl>

      <div className="rounded-3xl border border-[#E5E8EF] bg-white p-5 sm:p-6" data-testid="home-checklist">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{pending.length === 0 ? "Tu página está completa" : "Para dejar tu página lista"}</h2>
          <span className="rounded-full bg-[#FFF1E8] px-3 py-1 text-sm font-bold text-[#C73E00]">{q.score}%</span>
        </div>
        <div role="progressbar" aria-label="Avance de tu página" aria-valuenow={q.score} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDEFF4]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#FF8A4C] to-[#C73E00]" style={{ width: `${q.score}%` }} />
        </div>
        {pending.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm"><IconCheck className="size-5 text-emerald-600" />No te falta nada importante. Compartí tu link y mirá cómo entran las visitas.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {pending.slice(0, 5).map((i) => (
              <li key={i.id}>
                <Link href={`${MODULE_ROUTE[moduleOf(i.tab)]}?tab=${i.tab}`} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-[#E5E8EF] bg-[#FAFBFD] px-4 text-[15px] font-medium hover:border-[#FC5502] hover:bg-white focus-visible:outline-2 focus-visible:outline-ring">
                  <span>{i.label}{i.required && <span className="ml-2 rounded-full bg-[#FFF1E8] px-2 py-0.5 text-xs font-bold text-[#C73E00]">Necesario para publicar</span>}</span>
                  <IconArrowRight className="size-4 shrink-0 text-[#C73E00]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Atajos</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {actions.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link href={href} className="group flex min-h-16 items-center gap-3.5 rounded-2xl border border-[#E5E8EF] bg-white px-4 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-[#FC5502]/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"><span className="grid size-10 place-items-center rounded-xl bg-[#FFF1E8] text-[#C73E00] transition-colors group-hover:bg-[#FC5502] group-hover:text-white"><Icon className="size-5" /></span>{label}</Link>
            </li>
          ))}
        </ul>
      </div>

      <ReferralCard />
    </section>
  );
}
