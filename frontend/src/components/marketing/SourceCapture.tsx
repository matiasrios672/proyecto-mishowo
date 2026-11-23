"use client";

import { useEffect } from "react";

export const SOURCE_KEY = "mk:src";
export const REF_KEY = "mk:ref";

/** Guarda de dónde llegó la persona (utm_source o el sitio que la mandó) la primera vez que entra, para anotarlo al registrarse. Sin cookies. */
export function SourceCapture() {
  useEffect(() => {
    try {
      // Código de quien lo invitó (?ref=): se guarda aparte y gana sobre cualquier otro origen.
      const ref = new URLSearchParams(window.location.search).get("ref")?.trim().toLowerCase();
      if (ref && /^[a-z0-9]{6,12}$/.test(ref)) window.localStorage.setItem(REF_KEY, ref);
      if (window.sessionStorage.getItem(SOURCE_KEY)) return;
      const utm = new URLSearchParams(window.location.search).get("utm_source");
      let src = utm?.trim().toLowerCase();
      if (!src && document.referrer) {
        const host = new URL(document.referrer).hostname.replace(/^www\./, "");
        if (host && host !== window.location.hostname) src = host;
      }
      if (src) window.sessionStorage.setItem(SOURCE_KEY, src.slice(0, 60).replace(/[^a-z0-9._:\-/ ]/g, ""));
    } catch { /* sin sessionStorage (modo privado): simplemente no se anota el origen */ }
  }, []);
  return null;
}

export function readRef(): string | undefined {
  try { return window.localStorage.getItem(REF_KEY) || undefined; } catch { return undefined; }
}

export function readSource(): string | undefined {
  try { return window.sessionStorage.getItem(SOURCE_KEY) || undefined; } catch { return undefined; }
}
