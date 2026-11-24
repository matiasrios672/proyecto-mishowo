import type { ReactNode } from "react";

// Pedidos, estadísticas, plan…: el marco con la barra lateral vive en el layout de /panel (PanelRoot).
export default function PanelPagesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
