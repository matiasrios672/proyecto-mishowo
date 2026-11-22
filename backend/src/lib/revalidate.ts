import type { Config } from "../config.js";

export type SiteChanged = (slug: string) => void;

/**
 * Avisa al frontend que la página de un negocio cambió para que invalide su caché y se vea al instante.
 * No espera ni falla: si el aviso no llega, la página se actualiza sola cuando vence el caché (minutos).
 */
export function createRevalidator(config: Config, log?: (msg: string) => void): SiteChanged {
  return (slug) => {
    if (!config.REVALIDATE_SECRET) return;
    fetch(`${config.FRONTEND_INTERNAL_URL}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": config.REVALIDATE_SECRET },
      body: JSON.stringify({ slug }),
      signal: AbortSignal.timeout(3000),
    }).catch((e: unknown) => log?.(`no se pudo avisar el cambio de ${slug}: ${String(e)}`));
  };
}
