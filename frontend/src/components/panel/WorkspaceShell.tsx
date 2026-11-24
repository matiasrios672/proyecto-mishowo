"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/brand/LoadingScreen";
import { useUser } from "@/components/auth/authStore";
import { EditorShell } from "@/components/editor/EditorShell";
import type { EditorModule } from "@/lib/modules";
import { PanelFrame } from "./PanelShell";

const MODULE_BY_PATH: Record<string, Exclude<EditorModule, "all">> = {
  "/panel/catalogo": "catalogo",
  "/panel/pagina": "pagina",
  "/panel/ajustes": "ajustes",
};

/**
 * Marco de los espacios de trabajo (catálogo, mi página, ajustes). Exige sesión y ocupa toda la pantalla.
 * Los tres módulos comparten UN solo editor que vive acá: al cambiar de módulo no se desmonta ni se recarga,
 * así el borrador, el guardado y la vista previa son siempre los mismos (nunca hay dos editores pisándose).
 */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  void children; // las páginas de cada módulo existen solo para tener su ruta
  const user = useUser();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (user === null) router.replace(`/ingresar?next=${encodeURIComponent(path)}`);
  }, [user, path, router]);

  if (!user) return <LoadingScreen message="Cargando tu panel…" />;
  const which = MODULE_BY_PATH[path] ?? "pagina";
  return (
    <PanelFrame fullBleed>
      <Suspense fallback={<p className="p-6 text-muted-foreground">Cargando tu página…</p>}>
        <EditorShell module={which} />
      </Suspense>
    </PanelFrame>
  );
}
