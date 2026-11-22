"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { API_URL, api } from "@/lib/authClient";
import { formatPrice, timeAgo } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

type Status = "nuevo" | "confirmado" | "listo" | "entregado" | "cancelado";
interface Order {
  id: string; number: number; status: Status; nextStatuses: Status[];
  customerName: string | null; customerPhone: string | null; notes: string | null; eventDate: string | null;
  total: number; createdAt: string;
  items: { name: string; optionLabel: string | null; unitPrice: number; quantity: number }[];
}
interface Summary { counts: Record<Status, number>; total: number }

const LABEL: Record<Status, string> = { nuevo: "Nuevo", confirmado: "Confirmado", listo: "Listo", entregado: "Entregado", cancelado: "Cancelado" };
const ACTION: Record<Exclude<Status, "nuevo">, string> = { confirmado: "Confirmar pedido", listo: "Marcar como listo", entregado: "Marcar como entregado", cancelado: "Cancelar pedido" };
const FILTERS: { id: Status | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" }, { id: "nuevo", label: "Nuevos" }, { id: "confirmado", label: "Confirmados" },
  { id: "listo", label: "Listos" }, { id: "entregado", label: "Entregados" }, { id: "cancelado", label: "Cancelados" },
];
const TONE: Record<Status, string> = {
  nuevo: "bg-primary text-primary-foreground", confirmado: "bg-muted text-foreground", listo: "bg-muted text-foreground",
  entregado: "border text-muted-foreground", cancelado: "border border-destructive/40 text-destructive",
};

export function OrdersPanel() {
  const [filter, setFilter] = useState<Status | "todos">("todos");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  // Se actualiza solo cada 30 s para ver los pedidos nuevos sin recargar.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const qs = filter === "todos" ? "" : `?status=${filter}`;
    Promise.all([
      api<{ orders: Order[]; nextBefore: string | null }>(`/me/orders${qs}`),
      api<Summary>("/me/orders/summary"),
    ]).then(([list, sum]) => {
      if (!alive) return;
      if (!list.ok) return setError(list.data.error === "no_business" ? "no_business" : "network");
      setError(null);
      setOrders(list.data.orders);
      setNextBefore(list.data.nextBefore);
      if (sum.ok) setSummary(sum.data);
    });
    return () => { alive = false; };
  }, [filter, tick]);

  async function setStatus(o: Order, status: Status) {
    setBusy(o.id);
    const r = await api<Order>(`/me/orders/${o.id}/status`, { method: "PATCH", body: { status } });
    setBusy(null);
    setConfirming(null);
    if (!r.ok) return setError("status");
    setOrders((cur) => cur?.map((x) => (x.id === o.id ? r.data : x)) ?? cur);
    setTick((n) => n + 1);
  }

  async function loadMore() {
    if (!nextBefore) return;
    setMore(true);
    const qs = `?before=${encodeURIComponent(nextBefore)}${filter === "todos" ? "" : `&status=${filter}`}`;
    const r = await api<{ orders: Order[]; nextBefore: string | null }>(`/me/orders${qs}`);
    setMore(false);
    if (!r.ok) return setError("network");
    setOrders((cur) => [...(cur ?? []), ...r.data.orders]);
    setNextBefore(r.data.nextBefore);
  }

  if (error === "no_business")
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="font-medium">Todavía no creaste tu página</p>
        <p className="mt-1 text-sm text-muted-foreground">Cuando la publiques, los pedidos de tus clientes aparecen acá.</p>
        <Button className="mt-4" render={<Link href="/editor" />}>Ir al editor</Button>
      </div>
    );

  return (
    <section aria-labelledby="pedidos-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="pedidos-title" className="text-2xl font-bold">Pedidos</h1>
        <a href={`${API_URL}/me/orders.csv`} download className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">Descargar CSV</a>
      </div>

      <div role="tablist" aria-label="Filtrar por estado" className="mt-4 flex gap-1 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const n = f.id === "todos" ? summary?.total : summary?.counts[f.id];
          return (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setOrders(null); }}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${filter === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {f.label}{n ? <span className="ml-1.5 opacity-80">{n}</span> : null}
            </button>
          );
        })}
      </div>

      {error && error !== "no_business" && (
        <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error === "status" ? "No pudimos cambiar el estado. Revisá que el pedido siga en el estado anterior e intentá de nuevo." : "No pudimos cargar tus pedidos. Revisá tu conexión: lo seguimos intentando."}
        </p>
      )}

      {orders === null && !error && <p className="mt-8 text-muted-foreground">Cargando pedidos…</p>}
      {orders?.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed p-8 text-center" data-testid="orders-empty">
          <p className="font-medium">{filter === "todos" ? "Todavía no te llegaron pedidos" : `No hay pedidos ${FILTERS.find((f) => f.id === filter)!.label.toLowerCase()}`}</p>
          {filter === "todos" && <p className="mt-1 text-sm text-muted-foreground">Compartí el link de tu página en Instagram y WhatsApp para recibir el primero.</p>}
        </div>
      )}

      <ul className="mt-5 space-y-4">
        {orders?.map((o) => {
          const wa = o.customerPhone ? whatsappLink(o.customerPhone, `Hola${o.customerName ? ` ${o.customerName}` : ""}! Te escribo por tu pedido #${o.number}.`) : null;
          return (
            <li key={o.id} className="rounded-xl border p-4" data-testid="order" data-status={o.status}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-semibold">Pedido #{o.number} <span className="ml-1 text-sm font-normal text-muted-foreground">{timeAgo(o.createdAt)}</span></p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONE[o.status]}`}>{LABEL[o.status]}</span>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {o.items.map((i, k) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span>{i.quantity} x {i.name}{i.optionLabel ? ` (${i.optionLabel})` : ""}</span>
                    <span className="tabular-nums text-muted-foreground">{formatPrice(i.unitPrice * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>Total</span><span className="tabular-nums">{formatPrice(o.total)}</span></p>
              {(o.customerName || o.customerPhone || o.eventDate || o.notes) && (
                <dl className="mt-3 space-y-0.5 text-sm text-muted-foreground">
                  {o.customerName && <div>Cliente: <span className="text-foreground">{o.customerName}</span></div>}
                  {o.customerPhone && <div>Teléfono: <span className="text-foreground">{o.customerPhone}</span></div>}
                  {o.eventDate && <div>Fecha del evento: <span className="text-foreground">{o.eventDate.split("-").reverse().join("/")}</span></div>}
                  {o.notes && <div>Aclaraciones: <span className="text-foreground">{o.notes}</span></div>}
                </dl>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {o.nextStatuses.filter((s) => s !== "cancelado").map((s) => (
                  <Button key={s} size="sm" disabled={busy === o.id} onClick={() => void setStatus(o, s)}>{ACTION[s as Exclude<Status, "nuevo">]}</Button>
                ))}
                {wa && <Button size="sm" variant="outline" render={<a href={wa} target="_blank" rel="noopener noreferrer" />}>Escribirle por WhatsApp</Button>}
                {o.nextStatuses.includes("cancelado") && (confirming === o.id ? (
                  <span className="flex items-center gap-2 text-sm">
                    ¿Cancelar este pedido? Se repone el stock.
                    <Button size="sm" variant="destructive" disabled={busy === o.id} onClick={() => void setStatus(o, "cancelado")}>Sí, cancelar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>No</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(o.id)}>{ACTION.cancelado}</Button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {nextBefore && <div className="mt-6 text-center"><Button variant="outline" disabled={more} onClick={() => void loadMore()}>{more ? "Cargando…" : "Ver pedidos anteriores"}</Button></div>}
    </section>
  );
}
