"use client";

import { useEffect } from "react";
import { API_URL } from "@/lib/authClient";

const API = API_URL;

function send(slug: string, body: Record<string, unknown>) {
  try {
    void fetch(`${API}/public/sites/${encodeURIComponent(slug)}/events`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true, credentials: "omit",
    }).catch(() => undefined);
  } catch { /* medir nunca puede romper la página */ }
}

/**
 * Estadísticas propias y respetuosas: sin cookies, sin guardar la IP y sin servicios de terceros.
 * Cuenta la visita, los productos que la gente llegó a ver y los clics a WhatsApp. No renderiza nada.
 */
export function SiteTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get("utm_source") ?? params.get("src") ?? undefined;
    send(slug, { type: "visit", ...(utm && /^[\w.\-+ ]{1,40}$/.test(utm) ? { utmSource: utm } : {}), ...(document.referrer ? { referrer: document.referrer.slice(0, 300) } : {}) });

    const seen = new Set<string>();
    const io = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          for (const e of entries) {
            const id = (e.target as HTMLElement).dataset.productId;
            if (!e.isIntersecting || !id || seen.has(id)) continue;
            seen.add(id); io?.unobserve(e.target);
            send(slug, { type: "product_view", productId: id });
          }
        }, { threshold: 0.6 })
      : null;
    document.querySelectorAll<HTMLElement>("[data-product-id]").forEach((el) => io?.observe(el));

    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as Element | null)?.closest?.("a[href]");
      if (a && /^https:\/\/wa\.me\//.test(a.getAttribute("href") ?? "")) send(slug, { type: "whatsapp_click" });
    };
    document.addEventListener("click", onClick, true);
    return () => { io?.disconnect(); document.removeEventListener("click", onClick, true); };
  }, [slug]);
  return null;
}
