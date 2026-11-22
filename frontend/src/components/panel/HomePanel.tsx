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
        <Link href="/crear" className="inline-flex min-h-11 items-center rounded-xl bg-[#2F6FB0] px-6 font-bold text-white">Empezar</Link>
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
    <section aria-labelledby="home-title" className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="home-title" className="text-2xl font-bold">{greeting()}{name ? `, ${name}` : ""}!</h1>
          <p className="mt-1 text-muted-foreground">{draft.name} · {published ? "tu página está publicada" : "tu página todavía no está publicada"}</p>
        </div>
        {published && <a href={siteUrl(biz.business.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#D6E4F2] px-4 font-semibold hover:bg-[#EAF4FC]"><IconStore className="size-5 text-[#2F6FB0]" />Ver mi página</a>}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3" data-testid="home-stats">
        {tiles.map(([label, value]) => <div key={label} className="border-t pt-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-3xl font-bold tabular-nums">{value}</dd></div>)}
      </dl>

      <div className="rounded-2xl border border-[#D6E4F2] bg-[#F4F9FE] p-5" data-testid="home-checklist">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">{pending.length === 0 ? "Tu página está completa" : "Para dejar tu página lista"}</h2>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-[#2F6FB0]">{q.score}%</span>
        </div>
        <div role="progressbar" aria-label="Avance de tu página" aria-valuenow={q.score} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-gradient-to-r from-[#74ACDF] to-[#2F6FB0]" style={{ width: `${q.score}%` }} />
        </div>
        {pending.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm"><IconCheck className="size-5 text-emerald-600" />No te falta nada importante. Compartí tu link y mirá cómo entran las visitas.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {pending.slice(0, 5).map((i) => (
              <li key={i.id}>
                <Link href={`${MODULE_ROUTE[moduleOf(i.tab)]}?tab=${i.tab}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-white px-4 text-[15px] font-medium hover:bg-[#EAF4FC] focus-visible:outline-2 focus-visible:outline-ring">
                  <span>{i.label}{i.required && <span className="ml-2 rounded-full bg-[#EAF4FC] px-2 py-0.5 text-xs font-bold text-[#2F6FB0]">Necesario para publicar</span>}</span>
                  <IconArrowRight className="size-4 shrink-0 text-[#2F6FB0]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-bold">Atajos</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {actions.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-14 items-center gap-3 rounded-2xl border border-[#D6E4F2] px-4 font-semibold hover:bg-[#EAF4FC] focus-visible:outline-2 focus-visible:outline-ring"><Icon className="size-6 text-[#2F6FB0]" />{label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
