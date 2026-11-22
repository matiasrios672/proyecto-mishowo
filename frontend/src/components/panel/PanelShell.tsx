"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, type NavGroup } from "@/components/brand/AppShell";
import { logoutFromShell, useUser } from "@/components/auth/authStore";
import { api } from "@/lib/authClient";
import { IconBag, IconCalendar, IconCard, IconChart, IconQr, IconShield, IconStore, IconTag } from "@/components/marketing/Doodles";

const GROUPS: NavGroup[] = [
  { label: "Vender", items: [
    { href: "/panel/pedidos", label: "Pedidos", Icon: IconBag },
    { href: "/panel/cupones", label: "Cupones", Icon: IconTag },
    { href: "/panel/turnos", label: "Turnos", Icon: IconCalendar },
  ] },
  { label: "Crecer", items: [
    { href: "/panel/estadisticas", label: "Estadísticas", Icon: IconChart },
    { href: "/panel/qr", label: "Código QR", Icon: IconQr },
  ] },
  { label: "Mi negocio", items: [
    { href: "/editor", label: "Diseñar mi página", Icon: IconStore },
    { href: "/panel/plan", label: "Plan y pagos", Icon: IconCard },
  ] },
];

const ADMIN_ROLES = ["owner", "admin", "support"];
/** El equipo de MiShowo ve además un acceso a su panel de administración. */
const groupsFor = (role: string, ordersEnabled: boolean): NavGroup[] => {
  // Con los pedidos apagados no tiene sentido mostrar Pedidos ni Cupones (los históricos siguen en la base).
  const base = ordersEnabled ? GROUPS : GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== "/panel/pedidos" && i.href !== "/panel/cupones") })).filter((g) => g.items.length > 0);
  return ADMIN_ROLES.includes(role) ? [...base, { label: "Equipo MiShowo", items: [{ href: "/admin", label: "Administración", Icon: IconShield }] }] : base;
};

/** ¿El negocio recibe pedidos? (por defecto sí). Se lee una vez al abrir el panel. */
function useOrdersEnabled(active: boolean) {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    api<{ content: { ordersEnabled?: boolean } | null }>("/me/business").then((r) => { if (alive && r.ok) setEnabled(r.data.content?.ordersEnabled !== false); });
    return () => { alive = false; };
  }, [active]);
  return enabled;
}

/** Marco con la barra lateral del panel (para quien ya inició sesión). El editor lo usa en modo angosto y a pantalla completa. */
export function PanelFrame({ children, compact = false, fullBleed = false }: { children: ReactNode; compact?: boolean; fullBleed?: boolean }) {
  const user = useUser();
  const ordersEnabled = useOrdersEnabled(!!user);
  if (!user) return <>{children}</>;
  return (
    <AppShell groups={groupsFor(user.role, ordersEnabled)} areaLabel="Panel del negocio" userLabel={user.email} onLogout={() => void logoutFromShell()} compact={compact} fullBleed={fullBleed}>
      {children}
    </AppShell>
  );
}

/** Marco del panel del negocio. Exige sesión: sin ella manda a ingresar y vuelve acá. */
export function PanelShell({ children }: { children: ReactNode }) {
  const user = useUser();
  const router = useRouter();
  const path = usePathname();
  const ordersEnabled = useOrdersEnabled(!!user);

  useEffect(() => {
    if (user === null) router.replace(`/ingresar?next=${encodeURIComponent(path)}`);
  }, [user, path, router]);

  if (!user) return <main className="p-6 text-muted-foreground">Cargando tu panel…</main>;

  return (
    <AppShell groups={groupsFor(user.role, ordersEnabled)} areaLabel="Panel del negocio" userLabel={user.email} onLogout={() => void logoutFromShell()}>
      {children}
    </AppShell>
  );
}
