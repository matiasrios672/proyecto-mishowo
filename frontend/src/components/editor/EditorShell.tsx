"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { DRAFT_KEY, loadDraft, countExamples } from "@/lib/draft";
import { ExampleBadge } from "@/components/onboarding/ExampleBadge";
import { Button } from "@/components/ui/button";

const LOADING = "__loading__";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function readRaw(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

// Provisorio (Épica 3): muestra el borrador cargado. El editor real llega en la Épica 4.
export function EditorShell() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => LOADING);
  const draft = useMemo(() => (raw === LOADING ? undefined : loadDraft({ getItem: () => raw || null, setItem() {}, removeItem() {} })), [raw]);

  if (draft === undefined) return <main className="p-6 text-muted-foreground">Cargando tu borrador…</main>;
  if (draft === null)
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="mb-4 text-2xl font-semibold">Todavía no elegiste un rubro</h1>
        <Button render={<Link href="/crear" />}>Elegir rubro</Button>
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold" data-testid="draft-name">
        {draft.name}
        {draft.nameIsExample && <ExampleBadge />}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {draft.tagline}
        {draft.textsAreExample && <ExampleBadge />}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">{countExamples(draft)} productos de ejemplo para reemplazar</p>
      {draft.categories.map((c) => (
        <section key={c.id} className="mt-6">
          <h2 className="mb-2 font-semibold">{c.name}</h2>
          <ul className="space-y-2">
            {c.products.map((p) => (
              <li key={p.id} className="rounded-lg border p-3">
                {p.name}
                {p.isExample && <ExampleBadge />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
