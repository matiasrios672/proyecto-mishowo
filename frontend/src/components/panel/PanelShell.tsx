"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, type NavGroup } from "@/components/brand/AppShell";
import { logoutFromShell, useUser } from "@/components/auth/authStore";
import { api } from "@/lib/authClient";
import { PageSwitcher } from "./PageSwitcher";
import { LoadingScreen } from "@/components/brand/LoadingScreen";
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
const groupsFor = (role: string, ordersEnabled: boolean, modules: Record<string, boolean> | null): NavGroup[] => {
  // Con los pedidos apagados no tiene sentido mostrar Pedidos ni Cupones (los históricos siguen en la base).
  // Los módulos que el plan no incluye tampoco se muestran: se ven en "Plan y pagos".
  const hidden = (href: string) => (!ordersEnabled && (href === "/panel/pedidos" || href === "/panel/cupones")) || (modules !== null && MODULE_OF[href] !== undefined && modules[MODULE_OF[href]!] === false);
  const base = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !hidden(i.href)) })).filter((g) => g.items.length > 0);
  return ADMIN_ROLES.includes(role) ? [...base, { label: "Equipo MiShowo", items: [{ href: "/admin", label: "Administración", Icon: IconShield }] }] : base;
};

/** ¿El negocio recibe pedidos? (por defecto sí) y qué módulos incluye su plan. Se lee una vez al abrir el panel. */
function useNavInfo(active: boolean) {
  const [info, setInfo] = useState<{ ordersEnabled: boolean; modules: Record<string, boolean> | null }>({ ordersEnabled: true, modules: null });
  useEffect(() => {
    if (!active) return;
    let alive = true;
    api<{ content: { ordersEnabled?: boolean } | null }>("/me/business").then((r) => { if (alive && r.ok) setInfo((i) => ({ ...i, ordersEnabled: r.data.content?.ordersEnabled !== false })); });
    api<{ current: { modules?: Record<string, boolean> } }>("/me/plan").then((r) => { if (alive && r.ok) setInfo((i) => ({ ...i, modules: r.data.current.modules ?? null })); });
    return () => { alive = false; };
  }, [active]);
  return info;
}

/** Marco con la barra lateral del panel (para quien ya inició sesión). El editor lo usa en modo angosto y a pantalla completa. */
export function PanelFrame({ children, compact = false, fullBleed = false }: { children: ReactNode; compact?: boolean; fullBleed?: boolean }) {
  const user = useUser();
  const { ordersEnabled, modules } = useNavInfo(!!user);
  if (!user) return <>{children}</>;
  return (
    <AppShell groups={groupsFor(user.role, ordersEnabled, modules)} areaLabel="Panel del negocio" userLabel={user.email} onLogout={() => void logoutFromShell()} compact={compact} fullBleed={fullBleed} topSlot={<PageSwitcher />}>
      {children}
    </AppShell>
  );
}

/** Marco del panel del negocio. Exige sesión: sin ella manda a ingresar y vuelve acá. */
export function PanelShell({ children }: { children: ReactNode }) {
  const user = useUser();
  const router = useRouter();
  const path = usePathname();
  const { ordersEnabled, modules } = useNavInfo(!!user);

  useEffect(() => {
    if (user === null) router.replace(`/ingresar?next=${encodeURIComponent(path)}`);
  }, [user, path, router]);

  if (!user) return <LoadingScreen message="Cargando tu panel…" />;

  return (
    <AppShell groups={groupsFor(user.role, ordersEnabled, modules)} areaLabel="Panel del negocio" userLabel={user.email} onLogout={() => void logoutFromShell()} topSlot={<PageSwitcher />}>
      {children}
    </AppShell>
  );
}
