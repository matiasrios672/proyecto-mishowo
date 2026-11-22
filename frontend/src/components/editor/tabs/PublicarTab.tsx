"use client";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/fields";
import { quality } from "@/lib/score";
import type { TabProps } from "./types";

export function PublicarTab({ draft, goTab }: TabProps) {
  const q = quality(draft);
  const pending = q.items.filter((i) => !i.done);
  const done = q.items.filter((i) => i.done);

  return (
    <div className="space-y-6">
      <Section title="Antes de publicar">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <p className="font-medium" data-testid="score-text">Tu página está al {q.score}%</p>
            <p className="text-xs text-muted-foreground">{done.length} de {q.items.length} listo</p>
          </div>
          <div role="progressbar" aria-label="Calidad de tu página" aria-valuemin={0} aria-valuemax={100} aria-valuenow={q.score} className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${q.score}%` }} />
          </div>
          {q.tip && <p className="mt-2 text-sm text-muted-foreground">Próximo paso: {q.tip}</p>}
        </div>

        {pending.length > 0 && (
          <ul className="space-y-2" aria-label="Pendientes">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm">
                  {i.label}
                  {i.required && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Obligatorio</span>}
                </span>
                <Button size="sm" variant="outline" onClick={() => goTab(i.tab)}>Completar</Button>
              </li>
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <ul className="space-y-1 text-sm text-muted-foreground" aria-label="Completados">
            {done.map((i) => <li key={i.id}><span aria-hidden>✓ </span>{i.doneLabel}</li>)}
          </ul>
        )}
      </Section>

      <Section title="Publicar">
        <Button size="lg" disabled aria-describedby="pub-note" className="w-full">Publicar mi página</Button>
        <p id="pub-note" className="text-sm text-muted-foreground">
          {q.canPublish
            ? "Tu página está lista. En breve vas a poder crear tu cuenta y publicarla con tu propio link."
            : `Te falta completar ${q.missingRequired.length} paso${q.missingRequired.length === 1 ? "" : "s"} obligatorio${q.missingRequired.length === 1 ? "" : "s"} para poder publicar.`}
        </p>
      </Section>
    </div>
  );
}
