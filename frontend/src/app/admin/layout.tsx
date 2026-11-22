import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { BrandScope } from "@/components/brand/BrandScope";

export const metadata: Metadata = { title: { default: "Administración", template: "%s · Administración" }, robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  // El marco lee la URL (usePathname): en rutas dinámicas Next exige que esté dentro de Suspense.
  return (
    <BrandScope><Suspense fallback={<main className="p-6 text-muted-foreground">Cargando…</main>}>
      <AdminShell>{children}</AdminShell>
    </Suspense></BrandScope>
  );
}
