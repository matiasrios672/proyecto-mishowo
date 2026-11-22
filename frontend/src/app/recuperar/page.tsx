import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/TokenForms";

export const metadata: Metadata = { title: "Recuperá tu contraseña", robots: { index: false } };

export default function Page() {
  return (
    <AuthShell title="Recuperá tu contraseña" subtitle="Te mandamos un enlace a tu email para elegir una nueva." footer={<Link className="underline" href="/ingresar">Volver a ingresar</Link>}>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}><ForgotForm /></Suspense>
    </AuthShell>
  );
}
