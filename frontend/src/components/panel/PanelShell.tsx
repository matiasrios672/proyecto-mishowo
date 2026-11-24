"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell, type NavGroup } from "@/components/brand/AppShell";
import { logoutFromShell, useUser } from "@/components/auth/authStore";
import { api } from "@/lib/authClient";
import { PageSwitcher } from "./PageSwitcher";
import { NotifBell, type NotifItem } from "@/components/brand/NotifBell";
import { IconBag, IconCalendar, IconCard, IconChart, IconChat, IconCheck, IconHome, IconQr, IconShield, IconSparkle, IconStore, IconTag } from "@/components/marketing/Doodles";

const GROUPS: NavGroup[] = [
  { label: "General", items: [{ href: "/panel/inicio", label: "Inicio", Icon: IconHome, exact: true }] },
  { label: "Vender", items: [
    { href: "/panel/catalogo", label: "Catálogo", Icon: IconStore },
    { href: "/panel/pedidos", label: "Pedidos", Icon: IconBag },
    { href: "/panel/cupones", label: "Cupones", Icon: IconTag },
    { href: "/panel/turnos", label: "Turnos", Icon: IconCalendar },
    { href: "/panel/resenas", label: "Reseñas", Icon: IconCheck },
  ] },
  { label: "Crecer", items: [
    { href: "/panel/estadisticas", label: "Estadísticas", Icon: IconChart },
    { href: "/panel/qr", label: "Código QR", Icon: IconQr },
  ] },
  { label: "Mi negocio", items: [
    { href: "/panel/pagina", label: "Mi página", Icon: IconSparkle },
    { href: "/panel/ajustes", label: "Ajustes", Icon: IconChat },
    { href: "/panel/plan", label: "Plan y pagos", Icon: IconCard },
  ] },
];

const ADMIN_ROLES = ["owner", "admin", "support"];
/** El equipo de MiShowo ve además un acceso a su panel de administración. */
const MODULE_OF: Record<string, string> = { "/panel/pedidos": "orders", "/panel/cupones": "coupons", "/panel/turnos": "appointments", "/panel/resenas": "reviews" };
export const groupsFor = (role: string, ordersEnabled: boolean, modules: Record<string, boolean> | null): NavGroup[] => {
  // Con los pedidos apagados no tiene sentido mostrar Pedidos ni Cupones (los históricos siguen en la base).
  // Los módulos que el plan no incluye tampoco se muestran: se ven en "Plan y pagos".
  const hidden = (href: string) => (!ordersEnabled && (href === "/panel/pedidos" || href === "/panel/cupones")) || (modules !== null && MODULE_OF[href] !== undefined && modules[MODULE_OF[href]!] === false);
  const base = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !hidden(i.href)) })).filter((g) => g.items.length > 0);
  return ADMIN_ROLES.includes(role) ? [...base, { label: "Equipo MiShowo", items: [{ href: "/admin", label: "Administración", Icon: IconShield }] }] : base;
};

/** ¿El negocio recibe pedidos? (por defecto sí) y qué módulos incluye su plan. Se lee una vez al abrir el panel. */
export function useNavInfo(active: boolean) {
  const path = usePathname(); // el marco es único y persiste entre pantallas: se vuelve a leer al cambiar (ej. al activar pedidos en Ajustes)
  const [info, setInfo] = useState<{ ordersEnabled: boolean; modules: Record<string, boolean> | null }>({ ordersEnabled: true, modules: null });
  useEffect(() => {
    if (!active) return;
    let alive = true;
    api<{ content: { ordersEnabled?: boolean } | null }>("/me/business").then((r) => { if (alive && r.ok) setInfo((i) => ({ ...i, ordersEnabled: r.data.content?.ordersEnabled !== false })); });
    api<{ current: { modules?: Record<string, boolean> } }>("/me/plan").then((r) => { if (alive && r.ok) setInfo((i) => ({ ...i, modules: r.data.current.modules ?? null })); });
    return () => { alive = false; };
  }, [active, path]);
  return info;
}

/** Lo que espera atención en el negocio: pedidos nuevos y turnos por confirmar (solo de los módulos que tiene). */
async function loadAlerts(ordersEnabled: boolean, modules: Record<string, boolean> | null): Promise<NotifItem[]> {
  const out: NotifItem[] = [];
  if (ordersEnabled && modules?.orders !== false) {
    const r = await api<{ counts: Record<string, number> }>("/me/orders/summary");
    if (r.ok) out.push({ id: "orders", label: "Pedidos nuevos", n: r.data.counts.nuevo ?? 0, href: "/panel/pedidos", tone: "alert" });
  }
  if (modules?.appointments === true) {
    const r = await api<{ appointments: unknown[] }>("/me/appointments?status=pendiente");
    if (r.ok) out.push({ id: "appts", label: "Turnos por confirmar", n: r.data.appointments.length, href: "/panel/turnos" });
  }
  return out;
}

export function ClientBell({ ordersEnabled, modules, side }: { ordersEnabled: boolean; modules: Record<string, boolean> | null; side: "below" | "right" | "end" }) {
  const load = useCallback(() => loadAlerts(ordersEnabled, modules), [ordersEnabled, modules]);
  return <NotifBell load={load} side={side} empty="Todo al día: no hay pedidos ni turnos esperando." />;
}

/** Marco con la barra lateral del panel (para quien ya inició sesión). El editor lo usa en modo angosto y a pantalla completa. */
export function PanelFrame({ children, compact = false, fullBleed = false }: { children: ReactNode; compact?: boolean; fullBleed?: boolean }) {
  const user = useUser();
  const { ordersEnabled, modules } = useNavInfo(!!user);
  if (!user) return <>{children}</>;
  return (
    <AppShell groups={groupsFor(user.role, ordersEnabled, modules)} areaLabel="Panel del negocio" userLabel={user.email} onLogout={() => void logoutFromShell()} compact={compact} fullBleed={fullBleed} topSlot={<PageSwitcher />} bell={(side) => <ClientBell ordersEnabled={ordersEnabled} modules={modules} side={side} />}>
      {children}
    </AppShell>
  );
}
