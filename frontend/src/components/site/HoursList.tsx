"use client";

import { useSyncExternalStore } from "react";
import { dayIndex, groupHours, type Hours } from "@/lib/hours";

// El día de hoy depende del visitante: se calcula en el navegador (la página se sirve cacheada).
const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 60_000);
  return () => clearInterval(t);
};
const today = () => dayIndex(new Date());

export function HoursList({ hours }: { hours: Hours }) {
  const day = useSyncExternalStore(subscribe, today, () => null);
  return (
    <ul className="space-y-2">
      {groupHours(hours).map((g) => {
        const isToday = day !== null && day >= g.first && day <= g.last;
        return (
          <li key={g.first} className={isToday ? "font-semibold text-foreground" : "text-muted-foreground"}>
            {g.text}
            {isToday && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 align-middle text-xs font-medium text-primary-foreground">Hoy</span>}
          </li>
        );
      })}
    </ul>
  );
}
