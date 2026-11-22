"use client";

import { useSyncExternalStore } from "react";
import { openStatus, type Hours } from "@/lib/hours";

// El estado "Abierto ahora" depende de la hora del visitante: se calcula en el navegador
// (la página se sirve cacheada, así que no puede calcularse en el servidor).
function subscribe(cb: () => void) {
  const t = setInterval(cb, 30_000);
  return () => clearInterval(t);
}
const snapshot = () => Math.floor(Date.now() / 60_000);

export function OpenBadge({ hours }: { hours: Hours }) {
  const minute = useSyncExternalStore(subscribe, snapshot, () => null);
  if (minute === null) return <span className="inline-block h-5 w-32" aria-hidden />;
  const s = openStatus(hours, new Date(minute * 60_000));
  if (!s) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm" data-testid="open-badge">
      <span aria-hidden className={`size-2 rounded-full ${s.open ? "bg-green-600" : "bg-red-600"}`} />
      {s.label}
    </span>
  );
}
