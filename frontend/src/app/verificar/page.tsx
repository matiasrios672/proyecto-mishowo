import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmail } from "@/components/auth/TokenForms";

export const metadata: Metadata = { title: "Confirmá tu email", robots: { index: false } };

export default function Page() {
  return (
    <AuthShell title="Confirmá tu email"  footer={null}>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}><VerifyEmail /></Suspense>
    </AuthShell>
  );
}
