import type { ReactNode } from "react";
import { PanelShell } from "@/components/panel/PanelShell";

// Páginas de lectura y gestión (pedidos, estadísticas, plan…): barra lateral y una hoja blanca con el contenido.
export default function PanelPagesLayout({ children }: { children: ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
