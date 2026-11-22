import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/TokenForms";

export const metadata: Metadata = { title: "Elegí tu contraseña nueva", robots: { index: false } };

export default function Page() {
  return (
    <AuthShell title="Elegí tu contraseña nueva"  footer={null}>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}><ResetForm /></Suspense>
    </AuthShell>
  );
}
