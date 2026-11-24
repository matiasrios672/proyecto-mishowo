import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Ingresá a tu cuenta", robots: { index: false } };

export default function Page() {
  return (
    <AuthShell title="Ingresá a tu cuenta" subtitle="Es la misma puerta para clientes y para el equipo de MiShowo: te llevamos a lo tuyo." footer={<>¿Primera vez? <Link className="" href="/registro">Creá tu cuenta</Link></>}>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}><LoginForm /></Suspense>
    </AuthShell>
  );
}
