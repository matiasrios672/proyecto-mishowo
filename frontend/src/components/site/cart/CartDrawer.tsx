"use client";

import { useEffect, useRef, useState } from "react";
import { emptyCart, removeItem, setQuantity, totals } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { installmentValue, qualifies, type Installments } from "@/lib/installments";
import { buildOrderMessage, orderErrorMessage } from "@/lib/orderMessage";
import { whatsappLink } from "@/lib/whatsapp";
import { useCart, writeCart } from "./cartStore";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Props {
  slug: string; businessName: string; whatsapp: string; greeting: string;
  showQuantities: boolean; askEventDate: boolean;
  installments?: Installments;
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

export function CartDrawer({ slug, businessName, whatsapp, greeting, showQuantities, askEventDate, installments }: Props) {
  const cart = useCart(slug);
  const { count, total, hasUnpriced } = totals(cart);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [phone, setPhone] = useState("");
  const [wantInst, setWantInst] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
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

  // Valida el cupón en vivo con el subtotal actual. Es solo una vista previa: al enviar, el servidor vuelve a calcular todo.
  async function applyCoupon(code: string, subtotal: number, keepMsg = false) {
    try {
      const res = await fetch(`${API}/public/coupons/validate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, code, subtotal, ...(phone.trim() ? { customerPhone: phone.trim() } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 429) { setCoupon(null); return setCouponMsg("Probaste muchos códigos. Esperá un minuto y volvé a intentar."); }
      if (d?.valid) { setCoupon({ code: d.code, discount: d.discount }); setCouponMsg(null); return; }
      setCoupon(null);
      setCouponMsg(d?.reason === "min_purchase" ? `Este cupón se usa desde ${formatPrice(d.minPurchase)} de compra.` : keepMsg ? "El cupón ya no aplica a tu pedido." : "Ese cupón no es válido o ya no está disponible.");
    } catch {
      setCouponMsg("No pudimos validar el cupón. Revisá tu conexión.");
    }
  }
  // Si cambia el pedido, se revalida (el descuento puede cambiar o dejar de aplicar).
  useEffect(() => {
    if (!coupon) return;
    const t = setTimeout(() => void applyCoupon(coupon.code, total, true), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const discount = coupon ? Math.min(coupon.discount, total) : 0;
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
          ...(phone.trim() ? { customerPhone: phone.trim() } : {}),
          ...(coupon ? { couponCode: coupon.code } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(eventDate ? { eventDate } : {}),
          ...(source() ? { source: source() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === "coupon_invalid" || data?.error === "coupon_min_purchase") setCoupon(null);
        return setStatus({ kind: "error", message: orderErrorMessage(data?.error), offline: false });
      }

      // Se arma el mensaje con lo que calculó el servidor: precios y total confiables.
      const text = buildOrderMessage({
        greeting, number: data.number, items: data.items, total: data.total,
        customerName: data.customerName, notes: data.notes, eventDate: data.eventDate,
        couponCode: data.couponCode, discount: data.discount,
        installments: instFor(data.total),
      });
      const link = whatsappLink(whatsapp, text) ?? "";
      writeCart(slug, emptyCart());
      setStatus({ kind: "done", number: data.number, link });
      if (link) window.open(link, "_blank", "noopener");
    } catch {
      setStatus({ kind: "error", message: "No pudimos conectarnos para registrar tu pedido.", offline: true });
    }
  }

  // Cuotas: solo si el negocio las ofrece, el total alcanza el mínimo y el cliente tildó la casilla.
  const instFor = (amount: number) => (wantInst && qualifies(installments, amount) ? { count: installments.count, amount: installmentValue(amount, installments.count) } : null);
  const finalTotal = Math.max(0, total - discount);
  const instOffer = !hasUnpriced && qualifies(installments, finalTotal) ? installments : null;

  // Plan B sin conexión: se manda el pedido igual por WhatsApp (no queda registrado en el panel).
  const fallbackLink = whatsappLink(
    whatsapp,
    buildOrderMessage({ greeting, items: cart.items, total, hasUnpriced, customerName: name, notes, eventDate: eventDate || null, installments: instFor(Math.max(0, total - discount)) }),
  );

  if (count === 0 && !open) return null;

  return (
    <>
      {!open && count > 0 && (
        <div className="site-cartbar fixed inset-x-0 bottom-0 z-30 p-3 @2xl:hidden">
          <button type="button" onClick={(e) => openDrawer(e.currentTarget)} data-testid="cart-bar"
            className={`mx-auto flex w-full max-w-2xl items-center justify-between gap-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/25 transition-transform active:scale-[0.98] ${primary}`} style={radius}>
            <span className="flex items-center gap-2"><span key={count} className="site-bump grid min-w-6 place-items-center rounded-full bg-white/25 px-1.5 text-sm font-bold">{count}</span>Ver mi pedido</span>
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
                <div><button type="button" onClick={close} className="text-sm ">Seguir mirando</button></div>
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
                    <label className="block text-sm font-medium">Tu teléfono (opcional)
                      <input className={`${field} mt-1 font-normal`} value={phone} maxLength={30} inputMode="tel" autoComplete="tel" onChange={(e) => setPhone(e.target.value)} />
                    </label>
                    <label className="block text-sm font-medium">Aclaraciones (opcional)
                      <textarea className={`${field} mt-1 font-normal`} rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: sin cebolla, retiro a las 13" />
                    </label>

                    {coupon ? (
                      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm" data-testid="coupon-applied">
                        <span>Cupón <strong>{coupon.code}</strong> aplicado</span>
                        <span className="flex items-center gap-3"><span className="font-semibold">-{formatPrice(discount)}</span>
                          <button type="button" className="" onClick={() => { setCoupon(null); setCouponInput(""); setCouponMsg(null); }}>Sacar</button></span>
                      </div>
                    ) : couponOpen ? (
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <input className={`${field} font-normal uppercase`} value={couponInput} maxLength={30} placeholder="Tu código" aria-label="Código del cupón" autoCapitalize="characters" autoComplete="off"
                            onChange={(e) => { setCouponInput(e.target.value); setCouponMsg(null); }} onKeyDown={(e) => { if (e.key === "Enter" && couponInput.trim()) { e.preventDefault(); void applyCoupon(couponInput.trim(), total); } }} />
                          <button type="button" className="rounded-lg border px-4 text-sm font-medium disabled:opacity-60" disabled={!couponInput.trim()} onClick={() => void applyCoupon(couponInput.trim(), total)}>Aplicar</button>
                        </div>
                        {couponMsg && <p role="alert" className="text-sm text-destructive" data-testid="coupon-error">{couponMsg}</p>}
                      </div>
                    ) : (
                      <button type="button" className="text-sm " onClick={() => setCouponOpen(true)} data-testid="coupon-toggle">Tengo un cupón</button>
                    )}

                    <div className="flex items-baseline justify-between border-t pt-3">
                      <span className="font-medium">Total</span>
                      <span className="text-lg font-bold" data-testid="cart-total">{formatPrice(Math.max(0, total - discount))}{hasUnpriced ? " + a consultar" : ""}</span>
                    </div>
                    {instOffer && (
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" data-testid="installments-option">
                        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" checked={wantInst} onChange={(e) => setWantInst(e.target.checked)} />
                        <span>
                          <span className="block font-semibold">Quiero pagar en {instOffer.count} cuotas sin interés</span>
                          <span className="block text-muted-foreground">{instOffer.count} x {formatPrice(installmentValue(finalTotal, instOffer.count))}{instOffer.note ? `. ${instOffer.note}` : ""}. Lo coordinás con {businessName}.</span>
                        </span>
                      </label>
                    )}
                    <p className="text-xs text-muted-foreground">El pago y la entrega los coordinás directamente con {businessName}.</p>

                    {status.kind === "error" && (
                      <div role="alert" className="space-y-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        <p>{status.message}</p>
                        {status.offline && fallbackLink && (
                          <a href={fallbackLink} target="_blank" rel="noopener noreferrer" className="inline-block ">Enviar igual por WhatsApp (no queda registrado en su panel)</a>
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
