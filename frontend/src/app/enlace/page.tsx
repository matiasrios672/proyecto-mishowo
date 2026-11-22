import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { MagicConsume } from "@/components/auth/TokenForms";

export const metadata: Metadata = { title: "Entrá a MiShowo", robots: { index: false } };

export default function Page() {
  return (
    <AuthShell title="Entrá a MiShowo" subtitle="Tocá el botón para entrar sin contraseña." footer={null}>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}><MagicConsume /></Suspense>
    </AuthShell>
  );
}
