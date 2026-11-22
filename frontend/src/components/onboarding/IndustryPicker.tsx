"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDraftFromTemplate, saveDraft, type TemplateInput } from "@/lib/draft";
import type { TemplateSummary } from "@/lib/api";
import { getTheme } from "@/lib/themes";

const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function IndustryPicker({ templates }: { templates: TemplateSummary[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string) {
    setLoading(id);
    setError(null);
    try {
      const res = await fetch(`${PUBLIC_API}/public/templates/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("No pudimos cargar el rubro");
      const tpl = (await res.json()) as TemplateInput;
      saveDraft(createDraftFromTemplate(tpl));
      router.push("/editor");
    } catch {
      setError("No pudimos cargar ese rubro. Revisá tu conexión e intentá de nuevo.");
      setLoading(null);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {templates.map((t) => {
          const theme = getTheme(t.theme);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => choose(t.id)}
                disabled={loading !== null}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className="size-10 shrink-0 overflow-hidden rounded-lg border"
                  style={{ background: theme.bg, borderColor: theme.border }}
                >
                  <span
                    className="block size-full"
                    style={{ background: `linear-gradient(135deg, transparent 55%, ${theme.primary} 55%)` }}
                  />
                </span>
                <span>
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {loading === t.id ? "Preparando tu página…" : t.blurb}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <div aria-disabled="true" className="flex w-full items-center gap-3 rounded-xl border border-dashed p-4 opacity-70">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-lg">
              ✦
            </span>
            <span>
              <span className="flex items-center gap-2 font-medium">
                Contame tu idea
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Próximamente</span>
              </span>
              <span className="block text-sm text-muted-foreground">
                Describí tu negocio y armamos los textos por vos
              </span>
            </span>
          </div>
        </li>
      </ul>
    </div>
  );
}
