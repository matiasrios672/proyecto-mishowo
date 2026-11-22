import { connection } from "next/server";
import { DEFAULT_FAQ, type FaqItem } from "@/content/faq";
import { API_URL } from "./api";

export interface SiteConfig {
  banner: { text: string; link: string | null } | null;
  maintenance: { message: string } | null;
  faq: FaqItem[];
}
export const DEFAULT_CONFIG: SiteConfig = { banner: null, maintenance: null, faq: DEFAULT_FAQ };

/**
 * Ajustes globales editados desde el admin (aviso, mantenimiento, preguntas frecuentes).
 * Se piden por visita, no al compilar (el build de Docker no tiene backend), y si la API no responde
 * la landing sigue mostrando sus valores por defecto: nunca se rompe por esto.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  await connection();
  try {
    const res = await fetch(`${API_URL}/public/site-config`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return DEFAULT_CONFIG;
    const j = (await res.json()) as { banner: SiteConfig["banner"]; maintenance: SiteConfig["maintenance"]; faq: FaqItem[] | null };
    return { banner: j.banner ?? null, maintenance: j.maintenance ?? null, faq: j.faq && j.faq.length > 0 ? j.faq : DEFAULT_FAQ };
  } catch {
    return DEFAULT_CONFIG;
  }
}
