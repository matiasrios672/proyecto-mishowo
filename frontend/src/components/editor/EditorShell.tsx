"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { DRAFT_KEY, loadDraft } from "@/lib/draft";
import { Button } from "@/components/ui/button";
import { Editor } from "./Editor";

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

/** Carga el borrador de localStorage (sin parpadeo de hidratación) y arranca el editor. */
export function EditorShell() {
  // El editor usa este valor solo al montarse y desde ahí es dueño del estado (guarda por su cuenta).
  const raw = useSyncExternalStore(subscribe, readRaw, () => LOADING);
  const initial = useMemo(
    () => (raw === LOADING ? undefined : loadDraft({ getItem: () => raw || null, setItem() {}, removeItem() {} })),
    [raw],
  );

  if (initial === undefined) return <main className="p-6 text-muted-foreground">Cargando tu borrador…</main>;
  if (initial === null)
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="mb-4 text-2xl font-semibold">Todavía no elegiste un rubro</h1>
        <Button render={<Link href="/crear" />}>Elegir rubro</Button>
      </main>
    );
  return <Editor initial={initial} />;
}
