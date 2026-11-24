import type { ReactNode } from "react";

// Catálogo, Mi página y Ajustes: el marco y el editor viven en el layout de /panel (PanelRoot); acá solo existen las rutas.
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
