import { Isotipo } from "./Wordmark";

/**
 * Pantallita de «Cargando» de los paneles: el isotipo de MiShowo con un aro que gira.
 * Con movimiento reducido queda quieta (el texto avisa igual). Ocupa toda la pantalla.
 */
export function LoadingScreen({ message = "Cargando tu panel…" }: { message?: string }) {
  return (
    <main role="status" aria-live="polite" data-testid="loading-screen" className="grid min-h-dvh place-items-center bg-[#FFFAF6] px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="relative grid size-24 place-items-center" aria-hidden>
          <span className="absolute inset-0 rounded-full border-4 border-[#F5D9C8] border-t-[#C73E00] motion-safe:animate-spin" />
          <Isotipo className="size-14 rounded-xl motion-safe:animate-pulse" />
        </span>
        <p className="text-lg font-semibold text-[#0E1B2C]">{message}</p>
      </div>
    </main>
  );
}
