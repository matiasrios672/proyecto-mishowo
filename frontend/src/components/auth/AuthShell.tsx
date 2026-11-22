import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" aria-label="MiShowo, ir al inicio" className="mb-6 self-start"><Wordmark /></Link>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 mb-6 text-muted-foreground">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-6"}>{children}</div>
      {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
    </main>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{message}</p>;
}

export function FormNotice({ children }: { children: ReactNode }) {
  return <p role="status" className="rounded-lg bg-muted p-3 text-sm">{children}</p>;
}
