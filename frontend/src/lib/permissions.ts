// Permisos del equipo de MiShowo (el catálogo y las plantillas vienen del servidor: backend/src/lib/permissions.ts).
export type AreaKey =
  | "negocios" | "usuarios" | "pagos" | "planes" | "leads" | "consultas" | "denuncias" | "emails" | "contenido" | "rubros" | "sistema" | "auditoria";
export type Level = "view" | "manage";
export type Permissions = Partial<Record<AreaKey, Level>>;
export interface AreaInfo { key: AreaKey; label: string; view: string; manage: string }

const rank = (l: Level | undefined) => (l === "manage" ? 2 : l === "view" ? 1 : 0);

/** ¿Estos permisos alcanzan para el nivel pedido? (gestionar incluye ver) */
export const allows = (p: Permissions | undefined, area: AreaKey, level: Level = "view") => rank(p?.[area]) >= rank(level);

export const sameAs = (a: Permissions, b: Permissions, areas: readonly AreaInfo[]) => areas.every((x) => (a[x.key] ?? null) === (b[x.key] ?? null));
