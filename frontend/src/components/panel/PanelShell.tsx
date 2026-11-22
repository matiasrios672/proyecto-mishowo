"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { logout, useUser } from "@/components/auth/authStore";

const LINKS = [
  { href: "/panel/pedidos", label: "Pedidos" },
  { href: "/panel/estadisticas", label: "Estadísticas" },
  { href: "/panel/qr", label: "QR" },
  { href: "/panel/plan", label: "Plan" },
  { href: "/editor", label: "Mi página" },
];

/** Marco del panel del negocio. Exige sesión: sin ella manda a ingresar y vuelve acá. */
export function PanelShell({ children }: { children: ReactNode }) {
  const user = useUser();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (user === null) router.replace(`/ingresar?next=${encodeURIComponent(path)}`);
  }, [user, path, router]);

  if (!user) return <main className="p-6 text-muted-foreground">Cargando tu panel…</main>;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b py-3">
        <Link href="/" aria-label="MiShowo, ir al inicio"><Wordmark /></Link>
        <nav aria-label="Panel" className="flex gap-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm ${path === l.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="max-w-44 truncate">{user.email}</span>
          <button type="button" onClick={() => void logout()} className="rounded-md px-2 py-1 hover:bg-muted">Salir</button>
        </span>
      </header>
      <div className="flex-1 py-6">{children}</div>
    </div>
  );
}
