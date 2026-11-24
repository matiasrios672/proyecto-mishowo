import { toast } from "./toastStore";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Llamadas que NO avisan: lecturas, el autoguardado del editor (tiene su propio indicador), el ingreso (muestra su error en el formulario) y vistas previas. */
const QUIET: RegExp[] = [/^\/auth\//, /^\/public\//, /^\/me\/business$/, /^\/me\/media/, /^\/me\/slug/, /\/preview$/, /^\/admin\/2fa\//, /^\/admin\/me$/, /^\/me\/track/];

/** Qué decir cuando sale bien. Lo primero que coincida (método + ruta). Para sumar un aviso nuevo alcanza con agregar una línea. */
const SUCCESS: [Method | "*", RegExp, string][] = [
  ["POST", /^\/admin\/users\/[^/]+\/block$/, "Cuenta bloqueada. Se cerraron sus sesiones."],
  ["POST", /^\/admin\/users\/[^/]+\/unblock$/, "Cuenta desbloqueada."],
  ["POST", /^\/admin\/admins\/invite$/, "Invitación enviada al equipo."],
  ["POST", /^\/admin\/admins\/email$/, "Comunicado enviado al equipo."],
  ["POST", /^\/admin\/admins\/[^/]+\/email$/, "Mail enviado."],
  ["POST", /^\/admin\/admins\/[^/]+\/resend-invite$/, "Invitación reenviada."],
  ["POST", /^\/admin\/admins\/[^/]+\/reset-2fa$/, "2FA reiniciado."],
  ["PUT", /^\/admin\/admins\/[^/]+\/permissions$/, "Permisos guardados."],
  ["DELETE", /^\/admin\/admins\/[^/]+$/, "Acceso del equipo quitado."],
  ["POST", /^\/admin\/admins$/, "Acceso dado al equipo."],
  ["POST", /^\/admin\/payments\/manual$/, "Plan cargado."],
  ["POST", /^\/admin\/payments\/[^/]+\/confirm$/, "Pago confirmado. Se activó el plan."],
  ["POST", /^\/admin\/payments\/[^/]+\/reject$/, "Pago rechazado."],
  ["PUT", /^\/admin\/plans\//, "Plan guardado."],
  ["PUT", /^\/admin\/settings\/payment$/, "Datos de cobro guardados."],
  ["PUT", /^\/admin\/settings\//, "Contenido guardado."],
  ["PUT", /^\/admin\/system\/maintenance$/, "Modo mantenimiento actualizado."],
  ["POST", /^\/admin\/system\/demo$/, "Negocios de ejemplo listos."],
  ["POST", /^\/admin\/emails\/templates\/[^/]+\/test$/, "Mail de prueba enviado."],
  ["PUT", /^\/admin\/emails\/templates\//, "Plantilla guardada."],
  ["DELETE", /^\/admin\/emails\/templates\//, "Plantilla restaurada al texto original."],
  ["PUT", /^\/admin\/emails\/automation$/, "Automatización guardada."],
  ["POST", /^\/admin\/emails\/campaigns\/[^/]+\/send$/, "Comunicado en camino."],
  ["POST", /^\/admin\/emails\/campaigns\/[^/]+\/cancel$/, "Comunicado cancelado."],
  ["POST", /^\/admin\/emails\/campaigns$/, "Borrador guardado."],
  ["PUT", /^\/admin\/emails\/campaigns\//, "Borrador guardado."],
  ["POST", /^\/admin\/leads\/[^/]+\/nudge$/, "Mail enviado."],
  ["POST", /^\/admin\/contact\/[^/]+\/reply$/, "Respuesta enviada."],
  ["PUT", /^\/admin\/industries\//, "Rubro guardado."],
  ["POST", /^\/admin\/reports\/[^/]+\/resolve$/, "Denuncia resuelta."],
  ["*", /^\/admin\/businesses\//, "Negocio actualizado."],
  ["*", /^\/admin\/contact\//, "Consulta actualizada."],
  ["POST", /^\/me\/coupons$/, "Cupón creado."],
  ["DELETE", /^\/me\/coupons\//, "Cupón eliminado."],
  ["*", /^\/me\/coupons\//, "Cupón actualizado."],
  ["*", /^\/me\/orders\/[^/]+\/status$/, "Estado del pedido actualizado."],
  ["PUT", /^\/me\/appointments\/settings$/, "Turnos guardados."],
  ["*", /^\/me\/appointments\/[^/]+\/status$/, "Turno actualizado."],
  ["*", /^\/me\/reviews\//, "Reseña actualizada."],
  ["POST", /^\/me\/payments$/, "Recibimos tu aviso de pago."],
  ["POST", /^\/me\/payments\/[^/]+\/receipt$/, "Comprobante enviado."],
  ["POST", /^\/me\/business\/unpublish$/, "Tu página ya no está publicada."],
];

function errorText(status: number): string {
  if (status === 0) return "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.";
  if (status === 401) return "Tu sesión venció. Ingresá de nuevo.";
  if (status === 403) return "No tenés permiso para hacer esto.";
  if (status === 429) return "Demasiados intentos seguidos. Esperá un minuto.";
  if (status >= 500) return "Algo falló de nuestro lado. Probá de nuevo en un momento.";
  return "No se pudo completar la acción. Revisá los datos e intentá de nuevo.";
}

/** Aviso automático tras cada cambio (POST/PUT/PATCH/DELETE) hecho con `api()`. Se puede acallar con `quiet` o reemplazar el texto con `toastText`. */
export function notifyResult(method: Method, path: string, res: { ok: boolean; status: number }, opts: { quiet?: boolean; toastText?: string } = {}) {
  if (method === "GET" || opts.quiet) return;
  const clean = path.split("?")[0]!;
  if (QUIET.some((r) => r.test(clean))) return;
  if (!res.ok) { toast.error(errorText(res.status)); return; }
  const hit = SUCCESS.find(([m, r]) => (m === "*" || m === method) && r.test(clean));
  if (opts.toastText) toast.success(opts.toastText);
  else if (hit) toast.success(hit[2]);
  else if (clean.startsWith("/admin/")) toast.success("Cambio guardado.");
}
