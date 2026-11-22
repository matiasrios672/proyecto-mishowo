import { Suspense } from "react";
import type { Metadata } from "next";
import { EditorShell } from "@/components/editor/EditorShell";
import { BrandScope } from "@/components/brand/BrandScope";

export const metadata: Metadata = { title: "Editor", robots: { index: false } };

export default function EditorPage() {
  return <BrandScope><Suspense fallback={<main className="p-6 text-muted-foreground">Cargando…</main>}><EditorShell /></Suspense></BrandScope>;
}
