import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/Wordmark";
import { THEMES, themeStyle, contrast } from "@/lib/themes";
import { FONT_PAIRS, fontPairStyle } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  const allFonts = FONT_PAIRS.map((p) => p.classes).join(" ");
  return (
    <main className={`${allFonts} mx-auto w-full max-w-5xl px-4 py-8 sm:px-6`}>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Wordmark />
        <p className="text-sm text-muted-foreground">Design system · uso interno</p>
      </header>

      <section aria-labelledby="temas" className="mb-12">
        <h1 id="temas" className="mb-1 text-2xl font-semibold">Temas de color</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {THEMES.length} temas. Todos cumplen contraste AA (se verifica en los tests).
        </p>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <li
              key={t.id}
              style={themeStyle(t.id)}
              className="rounded-xl border bg-background p-4 text-foreground"
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-semibold">{t.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {contrast(t.fg, t.bg).toFixed(1)}:1
                </span>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">{t.suggestedFor}</p>
              <div className="rounded-lg border bg-card p-3">
                <p className="mb-2 text-sm">Empanadas de carne, docena $18.000</p>
                <Button size="sm">Agregar al pedido</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tipos" className="mb-12">
        <h2 id="tipos" className="mb-4 text-2xl font-semibold">Pares tipográficos</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FONT_PAIRS.map((p) => (
            <li key={p.id} style={fontPairStyle(p.id)} className="rounded-xl border p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{p.name}</p>
              <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                Tu página que vende
              </p>
              <p className="text-sm">Pedí por WhatsApp, retirá hoy o coordiná la entrega.</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="botones">
        <h2 id="botones" className="mb-4 text-2xl font-semibold">Botones</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Creá tu página gratis</Button>
          <Button variant="secondary">Ver ejemplos</Button>
          <Button variant="outline">Guardar borrador</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="destructive">Eliminar</Button>
        </div>
      </section>
    </main>
  );
}
