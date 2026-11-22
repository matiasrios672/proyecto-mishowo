import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/panel/WorkspaceShell";

// Espacios de trabajo (catálogo, mi página, ajustes): barra lateral y pantalla completa con vista previa en vivo.
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
