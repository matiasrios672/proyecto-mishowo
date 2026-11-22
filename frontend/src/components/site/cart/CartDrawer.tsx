"use client";

import { useEffect, useRef, useState } from "react";
import { emptyCart, removeItem, setQuantity, totals } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { buildOrderMessage, orderErrorMessage } from "@/lib/orderMessage";
import { whatsappLink } from "@/lib/whatsapp";
import { useCart, writeCart } from "./cartStore";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Props {
  slug: string; businessName: string; whatsapp: string; greeting: string;
  showQuantities: boolean; askEventDate: boolean;
}

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; message: string; offline: boolean }
  | { kind: "done"; number: number; link: string };

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const primary = "bg-primary px-4 py-3 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";
const radius = { borderRadius: "var(--btn-radius)" } as const;

function source(): string | null {
  try {
    const utm = new URLSearchParams(window.location.search).get("utm_source");
    if (utm) return utm.slice(0, 40);
    return document.referrer ? new URL(document.referrer).hostname.slice(0, 40) : "directo";
  } catch {
    return null;
  }
}

export function CartDrawer({ slug, businessName, whatsapp, greeting, showQuantities, askEventDate }: Props) {
  const cart = useCart(slug);
  const { count, total, hasUnpriced } = totals(cart);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [today, setToday] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // La barra superior (computadora) pide abrir el pedido con un evento: así no comparten estado.
  useEffect(() => {
    const onOpen = () => openDrawer(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    window.addEventListener("mishowo:open-cart", onOpen);
    return () => window.removeEventListener("mishowo:open-cart", onOpen);
  }, []);

  function openDrawer(opener: HTMLElement | null) {
    openerRef.current = opener;
    const d = new Date();
    setToday(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    setStatus((s) => (s.kind === "done" ? s : { kind: "idle" }));
    setOpen(true);
  }
  function close() {
    setOpen(false);
    openerRef.current?.focus();
  }

  const waDisabled = !whatsappLink(whatsapp, "x");
  const needsDate = askEventDate && !eventDate;

  async function send() {
    if (needsDate) return setStatus({ kind: "error", message: orderErrorMessage("event_date_required"), offline: false });
    setStatus({ kind: "sending" });
    try {
      const res = await fetch(`${API}/public/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          items: cart.items.map((i) => ({ productId: i.productId, ...(i.optionId ? { optionId: i.optionId } : {}), quantity: i.quantity })),
          ...(name.trim() ? { customerName: name.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(eventDate ? { eventDate } : {}),
          ...(source() ? { source: source() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setStatus({ kind: "error", message: orderErrorMessage(data?.error), offline: false });

      // Se arma el mensaje con lo que calculó el servidor: precios y total confiables.
      const text = buildOrderMessage({
        greeting, number: data.number, items: data.items, total: data.total,
        customerName: data.customerName, notes: data.notes, eventDate: data.eventDate,
      });
      const link = whatsappLink(whatsapp, text) ?? "";
      writeCart(slug, emptyCart());
      setStatus({ kind: "done", number: data.number, link });
      if (link) window.open(link, "_blank", "noopener");
    } catch {
      setStatus({ kind: "error", message: "No pudimos conectarnos para registrar tu pedido.", offline: true });
    }
  }

  // Plan B sin conexión: se manda el pedido igual por WhatsApp (no queda registrado en el panel).
  const fallbackLink = whatsappLink(
    whatsapp,
    buildOrderMessage({ greeting, items: cart.items, total, hasUnpriced, customerName: name, notes, eventDate: eventDate || null }),
  );

  if (count === 0 && !open) return null;

  return (
    <>
      {!open && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 @2xl:hidden">
          <button type="button" onClick={(e) => openDrawer(e.currentTarget)} data-testid="cart-bar"
            className={`mx-auto flex w-full max-w-2xl items-center justify-between shadow-lg ${primary}`} style={radius}>
            <span>Ver mi pedido · {count} {count === 1 ? "producto" : "productos"}</span>
            <span>{formatPrice(total)}{hasUnpriced ? "+" : ""}</span>
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={close}>
          <div role="dialog" aria-modal="true" aria-label="Tu pedido" onClick={(e) => e.stopPropagation()}
            className="site-sheet max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-background p-4 text-foreground shadow-xl @2xl:mb-auto @2xl:mt-16 @2xl:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Tu pedido</h2>
              <button ref={closeRef} type="button" onClick={close} className="rounded-md border px-3 py-1.5 text-sm">Cerrar</button>
            </div>

            {status.kind === "done" ? (
              <div className="space-y-3 py-4 text-center" role="status" data-testid="order-done">
                <p className="text-xl font-semibold">¡Pedido #{status.number} enviado!</p>
                <p className="text-sm text-muted-foreground">{businessName} ya lo recibió. Si no se abrió WhatsApp, tocá el botón para mandarles el mensaje.</p>
                {status.link && (
                  <a href={status.link} target="_blank" rel="noopener noreferrer" className={`inline-block ${primary}`} style={radius}>Abrir WhatsApp</a>
                )}
                <div><button type="button" onClick={close} className="text-sm underline">Seguir mirando</button></div>
              </div>
            ) : (
              <>
                {cart.items.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground">Tu pedido está vacío.</p>
                ) : (
                  <ul className="divide-y" aria-label="Productos del pedido">
                    {cart.items.map((i) => (
                      <li key={i.key} className="flex items-start justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="font-medium">{i.name}</p>
                          {i.optionLabel && <p className="text-sm text-muted-foreground">{i.optionLabel}</p>}
                          <p className="text-sm text-muted-foreground">{i.unitPrice === null ? "A consultar" : formatPrice(i.unitPrice * i.quantity)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {showQuantities ? (
                            <>
                              <button type="button" className="size-8 rounded-md border" aria-label={`Quitar una unidad de ${i.name}`} onClick={() => writeCart(slug, setQuantity(cart, i.key, i.quantity - 1))}>−</button>
                              <span className="min-w-6 text-center text-sm font-semibold">{i.quantity}</span>
                              <button type="button" className="size-8 rounded-md border" aria-label={`Agregar una unidad más de ${i.name}`} onClick={() => writeCart(slug, setQuantity(cart, i.key, i.quantity + 1))}>+</button>
                            </>
                          ) : null}
                          <button type="button" className="ml-1 rounded-md px-2 py-1 text-sm text-destructive" aria-label={`Sacar ${i.name} del pedido`} onClick={() => writeCart(slug, removeItem(cart, i.key))}>Sacar</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {cart.items.length > 0 && (
                  <div className="mt-3 space-y-3">
                    <label className="block text-sm font-medium">Tu nombre (opcional)
                      <input className={`${field} mt-1 font-normal`} value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
                    </label>
                    {askEventDate && (
                      <label className="block text-sm font-medium">Fecha del evento <span aria-hidden className="text-destructive">*</span>
                        <input type="date" className={`${field} mt-1 font-normal`} value={eventDate} min={today} required onChange={(e) => setEventDate(e.target.value)} />
                      </label>
                    )}
                    <label className="block text-sm font-medium">Aclaraciones (opcional)
                      <textarea className={`${field} mt-1 font-normal`} rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: sin cebolla, retiro a las 13" />
                    </label>

                    <div className="flex items-baseline justify-between border-t pt-3">
                      <span className="font-medium">Total</span>
                      <span className="text-lg font-bold" data-testid="cart-total">{formatPrice(total)}{hasUnpriced ? " + a consultar" : ""}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">El pago y la entrega los coordinás directamente con {businessName}.</p>

                    {status.kind === "error" && (
                      <div role="alert" className="space-y-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        <p>{status.message}</p>
                        {status.offline && fallbackLink && (
                          <a href={fallbackLink} target="_blank" rel="noopener noreferrer" className="inline-block underline">Enviar igual por WhatsApp (no queda registrado en su panel)</a>
                        )}
                      </div>
                    )}

                    <button type="button" onClick={send} disabled={waDisabled || status.kind === "sending"} className={`w-full ${primary}`} style={radius} data-testid="send-order">
                      {status.kind === "sending" ? "Enviando…" : "Enviar pedido por WhatsApp"}
                    </button>
                    {waDisabled && <p className="text-center text-xs text-muted-foreground">Este negocio todavía no cargó su WhatsApp.</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
