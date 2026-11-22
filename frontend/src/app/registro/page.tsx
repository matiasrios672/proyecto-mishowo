import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Creá tu cuenta", robots: { index: false } };

export default function Page() {
  return (
    <AuthShell title="Creá tu cuenta" subtitle="Guardá tu página, subí fotos y publicala con tu propio link." footer={<>¿Ya tenés cuenta? <Link className="underline" href="/ingresar">Ingresá</Link></>}>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}><RegisterForm /></Suspense>
    </AuthShell>
  );
}
