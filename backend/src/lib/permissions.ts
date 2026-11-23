import { z } from "zod";

/**
 * Permisos del equipo de MiShowo. Cada área tiene tres niveles: sin acceso, «ver» (mirar y anotar) y «gestionar» (cambiar cosas).
 * El Owner (sysadmin) tiene todo y es el único que administra el equipo y los datos de cobro: eso no se delega.
 * Soporte y Admin son plantillas: la persona arranca con una de ellas y el Owner puede ajustarle el resto área por área.
 */
export const AREAS = [
  { key: "negocios", label: "Negocios", view: "Ver fichas y dejar notas internas", manage: "Suspender, despublicar y eliminar negocios" },
  { key: "usuarios", label: "Usuarios", view: "Ver la lista de usuarios", manage: "Bloquear y desbloquear usuarios" },
  { key: "pagos", label: "Pagos", view: "Ver pagos y comprobantes", manage: "Confirmar, rechazar y registrar pagos" },
  { key: "planes", label: "Planes", view: "Ver planes y precios", manage: "Editar planes, precios y cambiar el plan de un negocio" },
  { key: "leads", label: "Leads", view: "Ver el embudo y los referidos", manage: "Exportar CSV y escribirles a los leads" },
  { key: "consultas", label: "Consultas", view: "Leer las consultas de contacto", manage: "Responder y cerrar consultas" },
  { key: "denuncias", label: "Denuncias", view: "Ver denuncias y dejar notas", manage: "Resolver denuncias (suspender o descartar)" },
  { key: "emails", label: "Emails", view: "Ver plantillas, probar y ver comunicados", manage: "Editar plantillas y enviar comunicados" },
  { key: "contenido", label: "Contenido", view: "Ver los textos de la web", manage: "Editar los textos de la web" },
  { key: "rubros", label: "Rubros", view: "Ver los rubros", manage: "Editar los rubros" },
  { key: "sistema", label: "Estado del sistema", view: "Ver el estado y la configuración", manage: "Modo mantenimiento y slugs reservados" },
  { key: "auditoria", label: "Auditoría", view: "Ver el registro de acciones", manage: "Ver el registro de acciones" },
] as const;

export type AreaKey = (typeof AREAS)[number]["key"];
export type Level = "view" | "manage";
export type Permissions = Partial<Record<AreaKey, Level>>;

const KEYS = AREAS.map((a) => a.key) as [AreaKey, ...AreaKey[]];
const rank = (l: Level | undefined) => (l === "manage" ? 2 : l === "view" ? 1 : 0);

const all = (level: Level): Permissions => Object.fromEntries(KEYS.map((k) => [k, level])) as Permissions;

/** Lo que tiene cada plantilla de rol (idéntico a lo que hacían los roles fijos antes de existir los permisos). */
export const PRESETS: Record<"admin" | "support", Permissions> = {
  admin: all("manage"),
  support: { negocios: "view", usuarios: "view", leads: "view", consultas: "manage", denuncias: "view", emails: "view", contenido: "view", rubros: "view", sistema: "view" },
};

export const permissionsSchema = z.record(z.enum(KEYS), z.enum(["view", "manage"]));

/** Limpia lo que venga de la base o del navegador: solo áreas conocidas y niveles válidos. */
export function normalizePermissions(raw: unknown): Permissions | null {
  if (raw === null || raw === undefined) return null;
  const p = permissionsSchema.safeParse(raw);
  return p.success ? (p.data as Permissions) : null;
}

/** Permisos efectivos de una persona del equipo: Owner todo; el resto, los suyos si el Owner se los ajustó, o los de su plantilla. */
export function effectivePermissions(user: { role: string; permissions?: unknown }): Permissions {
  if (user.role === "owner") return all("manage");
  const custom = normalizePermissions(user.permissions);
  if (custom) return custom;
  return PRESETS[user.role as "admin" | "support"] ?? {};
}

export const can = (user: { role: string; permissions?: unknown }, area: AreaKey, level: Level = "view"): boolean =>
  rank(effectivePermissions(user)[area]) >= rank(level);

/** Si los permisos pedidos son los de la plantilla del rol, no se guarda nada (así los cambios futuros de la plantilla le llegan). */
export function storedPermissions(role: "admin" | "support", requested: Permissions | undefined): Permissions | null {
  if (!requested) return null;
  const norm = normalizePermissions(requested);
  if (!norm) return null;
  const preset = PRESETS[role];
  const same = AREAS.every((a) => (norm[a.key] ?? null) === (preset[a.key] ?? null));
  return same ? null : norm;
}

