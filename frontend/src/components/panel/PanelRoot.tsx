"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/brand/AppShell";
import { LoadingScreen } from "@/components/brand/LoadingScreen";
import { logoutFromShell, useUser } from "@/components/auth/authStore";
import { EditorShell } from "@/components/editor/EditorShell";
import type { EditorModule } from "@/lib/modules";
import { ClientBell, groupsFor, useNavInfo } from "./PanelShell";
import { PageSwitcher } from "./PageSwitcher";

const MODULE_BY_PATH: Record<string, Exclude<EditorModule, "all">> = {
  "/panel/catalogo": "catalogo",
  "/panel/pagina": "pagina",
  "/panel/ajustes": "ajustes",
};

/**
 * Marco ÚNICO del panel del negocio. Vive en el layout de /panel, así que la barra lateral, la cuenta y los avisos
 * se montan una sola vez: al cambiar de módulo solo se actualiza el contenido, nunca toda la pantalla.
 * Catálogo, Mi página y Ajustes comparten un solo editor (pantalla completa con vista previa); el resto son páginas de lectura y gestión.
 */
export function PanelRoot({ children }: { children: ReactNode }) {
  const user = useUser();
  const router = useRouter();
  const path = usePathname();
  const { ordersEnabled, modules } = useNavInfo(!!user);

  useEffect(() => {
    if (user === null) router.replace(`/ingresar?next=${encodeURIComponent(path)}`);
  }, [user, path, router]);

  if (!user) return <LoadingScreen message="Cargando tu panel…" />;

  const workspace = MODULE_BY_PATH[path];
  return (
    <AppShell groups={groupsFor(user.role, ordersEnabled, modules)} areaLabel="Panel del negocio" userLabel={user.email} onLogout={() => void logoutFromShell()} fullBleed={!!workspace}
      topSlot={<PageSwitcher />} bell={(side) => <ClientBell ordersEnabled={ordersEnabled} modules={modules} side={side} />}>
      {workspace ? (
        <Suspense fallback={<p className="p-6 text-muted-foreground">Cargando tu página…</p>}>
          <EditorShell module={workspace} />
        </Suspense>
      ) : children}
    </AppShell>
  );
}
