export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface PublicUser { id: string; email: string; name: string | null; emailVerified: boolean; role: string }

export interface ApiResult<T> { ok: boolean; status: number; data: T & { error?: string } }

/** Llamada a la API con la cookie de sesión. Nunca lanza: una caída de red vuelve como `error: "network"`. */
export async function api<T = Record<string, unknown>>(
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      credentials: "include",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } as T & { error?: string } };
  }
}

/** Mensajes en voseo, sin jerga técnica. */
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "email_taken": return "Ya hay una cuenta con ese email. Probá ingresar.";
    case "password_too_short": return "La contraseña tiene que tener al menos 8 caracteres.";
    case "password_is_email": return "La contraseña no puede ser igual a tu email.";
    case "invalid_credentials": return "El email o la contraseña no son correctos.";
    case "blocked": return "Esta cuenta está bloqueada. Escribinos por WhatsApp para resolverlo.";
    case "invalid_token": return "Este enlace venció o ya se usó. Pedí uno nuevo.";
    case "invalid_request": return "Revisá los datos: algo no está bien escrito.";
    case "bad_origin": return "No pudimos validar tu pedido. Recargá la página e intentá de nuevo.";
    case "network": return "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.";
    default: return "Algo salió mal. Probá de nuevo en un momento.";
  }
}

/** Solo rutas internas: evita que `?next=` mande a alguien a un sitio externo después de ingresar. */
export function safeNext(next: string | null | undefined, fallback = "/editor"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
