"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/authClient";

interface Stats {
  days: number;
  totals: { visits: number; whatsappClicks: number; productViews: number; orders: number; conversion: number };
  series: { day: string; visits: number }[];
  sources: { source: string; visits: number }[];
  topProducts: { id: string; name: string; views: number }[];
}

const RANGES = [7, 30, 90] as const;
const SOURCE_LABEL: Record<string, string> = { directo: "Link directo", qr: "Código QR", instagram: "Instagram", facebook: "Facebook", google: "Google", whatsapp: "WhatsApp" };
const fmtDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

export function StatsPanel() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Stats | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "no_business" | "error">("loading");

  useEffect(() => {
    let alive = true;
    api<Stats>(`/me/stats?days=${days}`).then((r) => {
      if (!alive) return;
      if (r.ok) { setData(r.data); setState("ok"); } else setState(r.data.error === "no_business" ? "no_business" : "error");
    });
    return () => { alive = false; };
  }, [days]);

  if (state === "no_business") return <p className="rounded-xl border border-dashed p-6 text-center">Primero creá tu página en el editor y publicala para empezar a medir.</p>;
  if (state === "error") return <p role="alert" className="text-destructive">No pudimos cargar tus estadísticas. Probá de nuevo en un momento.</p>;
  if (!data) return <p className="text-muted-foreground">Cargando estadísticas…</p>;

  const t = data.totals;
  const max = Math.max(1, ...data.series.map((d) => d.visits));
  const maxTop = Math.max(1, ...data.topProducts.map((p) => p.views));
  const maxSrc = Math.max(1, ...data.sources.map((s) => s.visits));
  const empty = t.visits === 0 && t.whatsappClicks === 0 && t.orders === 0;
  const tiles: [string, string, string][] = [
    ["Visitas", String(t.visits), "Personas distintas que entraron, contadas una vez por día"],
    ["Clics a WhatsApp", String(t.whatsappClicks), "Toques en los botones para escribirte"],
    ["Pedidos", String(t.orders), "Pedidos que se armaron desde tu página"],
    ["Pedidos cada 100 visitas", String(t.conversion), "De cada 100 que entran, cuántas piden"],
  ];

  return (
    <section aria-labelledby="stats-title" className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="stats-title" className="text-2xl font-bold">Estadísticas</h1>
        <div role="group" aria-label="Período" className="flex gap-1">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}
              className={`rounded-full px-3 py-1.5 text-sm ${days === r ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Últimos {r} días</button>
          ))}
        </div>
      </div>

      {empty && (
        <p className="rounded-xl bg-muted p-4 text-sm" data-testid="stats-empty">
          Todavía no hay visitas en este período. Compartí tu link por Instagram o WhatsApp, o imprimí tu <Link href="/panel/qr" className="underline underline-offset-4">código QR</Link> y en un rato vas a ver los números acá.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4" data-testid="stats-totals">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="border-t pt-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-3xl font-bold tabular-nums">{value}</dd>
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </dl>

      <div>
        <h2 className="mb-3 font-semibold">Visitas por día</h2>
        <div role="img" aria-label={`Visitas por día: ${data.series.filter((d) => d.visits > 0).map((d) => `${fmtDay(d.day)} ${d.visits}`).join(", ") || "sin visitas"}`}
          className="flex h-36 items-end gap-px">
          {data.series.map((d) => (
            <div key={d.day} title={`${fmtDay(d.day)}: ${d.visits}`} className="flex-1 rounded-t-sm bg-primary" style={{ height: `${Math.max(2, (d.visits / max) * 100)}%`, opacity: d.visits ? 1 : 0.2 }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{fmtDay(data.series[0]!.day)}</span><span>{fmtDay(data.series.at(-1)!.day)}</span></div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">De dónde vienen</h2>
          {data.sources.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos todavía.</p> : (
            <ul className="space-y-2" data-testid="stats-sources">
              {data.sources.map((s) => (
                <li key={s.source} className="text-sm">
                  <div className="flex justify-between"><span>{SOURCE_LABEL[s.source] ?? s.source}</span><span className="tabular-nums">{s.visits}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(s.visits / maxSrc) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Productos más vistos</h2>
          {data.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos todavía.</p> : (
            <ol className="space-y-2" data-testid="stats-top">
              {data.topProducts.map((p) => (
                <li key={p.id} className="text-sm">
                  <div className="flex justify-between gap-3"><span className="truncate">{p.name}</span><span className="tabular-nums">{p.views}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(p.views / maxTop) * 100}%` }} /></div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Medimos sin cookies ni guardar la dirección IP de nadie. Tus visitas no son seguidas entre un día y otro.</p>
    </section>
  );
}
