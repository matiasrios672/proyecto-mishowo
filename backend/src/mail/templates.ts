// Plantillas de email: el texto por defecto vive acá y el sysadmin lo puede pisar desde /admin/emails (tabla email_templates).
// Las variables van entre llaves dobles: {{link}}. Una variable que no existe se reemplaza por vacío.
export interface TemplateDef {
  key: string;
  name: string;
  description: string;
  /** Cuándo se manda (se muestra en el admin). */
  trigger: string;
  group: "cuenta" | "planes" | "turnos" | "soporte" | "equipo";
  vars: { name: string; example: string; help: string }[];
  subject: string;
  body: string;
  /** Texto del botón (si la plantilla tiene {{link}}). */
  cta?: string;
  /** Arranca apagado: hay que prenderlo a propósito desde el admin (mails que salen solos a gente que no los pidió). */
  defaultOff?: boolean;
  /** No se puede apagar: sin estos mails la cuenta queda inutilizable (confirmación, recuperar contraseña…). */
  locked?: boolean;
}

const link = { name: "link", example: "https://mishowo.com/verificar?token=…", help: "Enlace de un solo uso" };

export const TEMPLATES: TemplateDef[] = [
  { key: "verify", name: "Confirmar email", group: "cuenta", locked: true, trigger: "Al crear la cuenta o pedir otro enlace de confirmación.", cta: "Confirmar mi email",
    description: "El primer mail que recibe cada persona.", vars: [link],
    subject: "Confirmá tu email en MiShowo",
    body: "¡Bienvenido a MiShowo!\n\nConfirmá tu email para poder publicar tu página:\n{{link}}\n\nEl enlace vale 24 horas. Si no creaste una cuenta, ignorá este mensaje." },
  { key: "welcome", name: "Bienvenida", group: "cuenta", trigger: "Cuando la persona confirma su email.", cta: "Ir a mi panel",
    description: "Primeros pasos después de confirmar. Se puede apagar.", vars: [{ name: "link", example: "https://mishowo.com/panel", help: "Enlace a su panel" }],
    subject: "¡Listo! Tu cuenta de MiShowo está confirmada",
    body: "Ya podés publicar tu página.\n\nTres pasos rápidos: cargá tus productos con foto y precio, elegí el diseño y publicá tu link para ponerlo en tu bio de Instagram.\n\n{{link}}\n\nSi necesitás ayuda, respondé este mail." },
  { key: "reset", name: "Recuperar contraseña", group: "cuenta", locked: true, trigger: "Cuando alguien pide restablecer su contraseña.", cta: "Elegir nueva contraseña",
    description: "Enlace de 1 hora para elegir otra contraseña.", vars: [link],
    subject: "Restablecé tu contraseña de MiShowo",
    body: "Pediste restablecer tu contraseña:\n{{link}}\n\nEl enlace vale 1 hora. Si no fuiste vos, ignorá este mensaje: tu contraseña sigue igual." },
  { key: "magic", name: "Enlace para entrar", group: "cuenta", locked: true, trigger: "Cuando alguien elige entrar sin contraseña.", cta: "Entrar a MiShowo",
    description: "Enlace de 15 minutos, un solo uso.", vars: [link],
    subject: "Tu enlace para entrar a MiShowo",
    body: "Entrá a MiShowo con este enlace:\n{{link}}\n\nVale 15 minutos y se puede usar una sola vez. Si no lo pediste, ignorá este mensaje." },
  { key: "payment_received", name: "Recibimos tu aviso de pago", group: "planes", trigger: "Cuando el cliente avisa que transfirió.",
    description: "Acuse de recibo del aviso de pago.", vars: [
      { name: "plan", example: "Emprende", help: "Nombre del plan" }, { name: "months", example: "3 meses", help: "Cantidad de meses" }, { name: "amount", example: "$ 29.700", help: "Importe" }],
    subject: "Recibimos tu aviso de pago",
    body: "Recibimos tu aviso de pago del plan {{plan}} por {{months}} ({{amount}}).\n\nLo vamos a revisar y activamos tu plan. Te avisamos por email apenas esté confirmado." },
  { key: "plan_confirmed", name: "Plan activado", group: "planes", trigger: "Cuando el equipo confirma un pago.",
    description: "Confirma el pago y hasta cuándo dura el plan.", vars: [{ name: "plan", example: "Pro", help: "Nombre del plan" }, { name: "until", example: "23/12/2026", help: "Fecha de vencimiento" }],
    subject: "¡Tu plan {{plan}} está activo!",
    body: "Confirmamos tu pago. Tu plan {{plan}} está activo hasta el {{until}}.\n\nGracias por elegir MiShowo." },
  { key: "payment_rejected", name: "Pago no confirmado", group: "planes", trigger: "Cuando el equipo rechaza un pago.",
    description: "Explica el motivo y cómo reintentar.", vars: [{ name: "reason", example: "El comprobante no se ve", help: "Motivo que cargó el equipo" }],
    subject: "No pudimos confirmar tu pago",
    body: "No pudimos confirmar tu pago.\n\nMotivo: {{reason}}\n\nPodés volver a avisar tu pago desde la sección de planes, o escribirnos para resolverlo." },
  { key: "plan_expiring", name: "Tu plan está por vencer", group: "planes", trigger: "Una vez, unos días antes del vencimiento (los días se configuran en Automatizaciones).",
    description: "Recordatorio de renovación.", vars: [{ name: "date", example: "30/11/2026", help: "Fecha de vencimiento" }],
    subject: "Tu plan de MiShowo está por vencer",
    body: "Tu plan vence el {{date}}. Si querés mantenerlo, avisanos tu pago desde la sección de planes antes de esa fecha.\n\nSi no lo renovás, tu página pasa al plan gratuito y sigue publicada." },
  { key: "plan_expired", name: "Tu plan venció", group: "planes", trigger: "El día que vence un plan pago.",
    description: "Avisa que pasó al plan gratis y que no se pierde nada.", vars: [],
    subject: "Tu plan de MiShowo venció",
    body: "Tu plan venció y tu página pasó al plan gratuito. Sigue publicada y no perdiste ningún dato.\n\nPodés volver a un plan pago cuando quieras desde la sección de planes." },
  { key: "appointment_received", name: "Recibimos tu reserva", group: "turnos", trigger: "Cuando un cliente reserva un turno y dejó su email.",
    description: "Acuse de la reserva: todavía falta que el negocio la confirme.", vars: [
      { name: "name", example: "Ana", help: "Cliente" }, { name: "business", example: "Peluquería Sol", help: "Negocio" }, { name: "date", example: "25/11/2026", help: "Día" }, { name: "time", example: "10:30", help: "Hora" },
      { name: "service", example: "Corte", help: "Servicio" }, { name: "staff", example: "Lu", help: "Profesional" }, { name: "price", example: "$ 8.000", help: "Precio" }],
    subject: "Recibimos tu reserva en {{business}}",
    body: "Hola {{name}},\n\nRecibimos tu reserva en {{business}} para el {{date}} a las {{time}}. {{service}}\n\nEl negocio te la va a confirmar. Si no podés ir, avisales por WhatsApp." },
  { key: "appointment_confirmed", name: "Turno confirmado", group: "turnos", trigger: "Cuando el negocio confirma un turno (si el cliente dejó su email).",
    description: "Confirma día y hora al cliente.", vars: [
      { name: "name", example: "Ana", help: "Cliente" }, { name: "business", example: "Peluquería Sol", help: "Negocio" }, { name: "date", example: "25/11/2026", help: "Día" }, { name: "time", example: "10:30", help: "Hora" },
      { name: "service", example: "Corte", help: "Servicio" }, { name: "staff", example: "Lu", help: "Profesional" }, { name: "price", example: "$ 8.000", help: "Precio" }],
    subject: "Tu turno en {{business}} está confirmado",
    body: "Hola {{name}},\n\nTu turno en {{business}} está confirmado: {{date}} a las {{time}}. {{service}}\n\n¡Te esperamos!" },
  { key: "appointment_cancelled", name: "Turno cancelado", group: "turnos", trigger: "Cuando el negocio cancela un turno (si el cliente dejó su email).",
    description: "Avisa la cancelación.", vars: [
      { name: "name", example: "Ana", help: "Cliente" }, { name: "business", example: "Peluquería Sol", help: "Negocio" }, { name: "date", example: "25/11/2026", help: "Día" }, { name: "time", example: "10:30", help: "Hora" }],
    subject: "Se canceló tu turno en {{business}}",
    body: "Hola {{name}},\n\nTu turno del {{date}} a las {{time}} en {{business}} se canceló. Escribinos por WhatsApp si querés reprogramarlo." },
  { key: "appointment_reminder", name: "Recordatorio de turno", group: "turnos", trigger: "Un día antes del turno (una sola vez, si el cliente dejó su email).",
    description: "Recordatorio automático 24 horas antes.", vars: [
      { name: "name", example: "Ana", help: "Cliente" }, { name: "business", example: "Peluquería Sol", help: "Negocio" }, { name: "date", example: "25/11/2026", help: "Día" }, { name: "time", example: "10:30", help: "Hora" },
      { name: "service", example: "Corte", help: "Servicio" }, { name: "staff", example: "Lu", help: "Profesional" }],
    subject: "Mañana tenés turno en {{business}}",
    body: "Hola {{name}},\n\nTe recordamos tu turno en {{business}}: {{date}} a las {{time}}. {{service}}\n\nSi no podés venir, avisanos con tiempo." },
  { key: "contact_ack", name: "Acuse de consulta", group: "soporte", trigger: "Cuando alguien escribe desde Contacto.",
    description: "Confirma que la consulta llegó.", vars: [{ name: "name", example: "Lupe", help: "Nombre de quien escribe" }, { name: "code", example: "a1b2c3d4", help: "Código de seguimiento" }],
    subject: "Recibimos tu consulta",
    body: "Hola {{name}},\n\nRecibimos tu consulta y te respondemos a este mismo email lo antes posible.\n\nCódigo de seguimiento: {{code}}\n\nMiShowo" },
  { key: "regret_ack", name: "Acuse de arrepentimiento", group: "soporte", locked: true, trigger: "Cuando alguien usa el botón de arrepentimiento.",
    description: "Obligatorio por ley: constancia de que se recibió.", vars: [{ name: "name", example: "Lupe", help: "Nombre de quien escribe" }, { name: "code", example: "a1b2c3d4", help: "Código de seguimiento" }],
    subject: "Recibimos tu solicitud de arrepentimiento",
    body: "Hola {{name}},\n\nRecibimos tu solicitud de arrepentimiento. La vamos a procesar y te respondemos a este mismo email dentro de los plazos legales (hasta 10 días corridos desde que contrataste).\n\nCódigo de seguimiento: {{code}}\n\nMiShowo" },
  { key: "lead_nudge", name: "Retomar tu página", group: "cuenta", defaultOff: true, trigger: "A quien se registró pero no publicó su página, pasados 2 días (una sola vez, automático si lo prendés) o cuando el equipo lo manda a mano.", cta: "Seguir con mi página",
    description: "Para recuperar a quienes no terminaron. Sale una sola vez por persona y no a quien se dio de baja de las novedades.", vars: [{ name: "name", example: "Lupe", help: "Nombre (o «emprendedor/a» si no lo cargó)" }, { name: "link", example: "https://mishowo.com/panel", help: "Enlace a su panel" }],
    subject: "¿Seguimos con tu página, {{name}}?",
    body: "Hola {{name}},\n\nVimos que empezaste a armar tu página en MiShowo pero todavía no la publicaste. Retomala donde la dejaste: en unos minutos queda lista y es gratis.\n\n{{link}}\n\nSi algo no te cierra o tenés dudas, respondé este mail y te damos una mano." },
  { key: "staff_invite", name: "Invitación al equipo", group: "equipo", trigger: "Cuando el Owner suma a alguien al equipo.", cta: "Crear mi contraseña",
    description: "Para que cada integrante elija su contraseña.", vars: [{ name: "name", example: "Sofi", help: "Nombre" }, { name: "role", example: "Soporte", help: "Rol asignado" }, { name: "link", example: "https://mishowo.com/restablecer?token=…", help: "Enlace para elegir contraseña (vale 3 días)" }],
    subject: "Te sumaron al equipo de MiShowo",
    body: "Hola {{name}},\n\nTe dieron acceso al equipo de MiShowo con el rol {{role}}.\n\nElegí tu contraseña acá:\n{{link}}\n\nAl ingresar al panel de administración te va a pedir configurar la verificación en dos pasos. El enlace vale 3 días." },
];

export const TEMPLATE_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));

export const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Reemplaza {{variable}}. `fmt` permite escapar para HTML. */
export function fill(text: string, vars: Record<string, string>, fmt: (v: string) => string = (v) => v): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, k: string) => fmt(vars[k] ?? ""));
}

/** Como `fill`, pero escapa también el texto de la plantilla: lo que escribe el sysadmin nunca se interpreta como HTML. */
export function fillHtml(text: string, vars: Record<string, string>): string {
  let out = "", last = 0;
  for (const m of text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) {
    out += esc(text.slice(last, m.index)) + esc(vars[m[1]!] ?? "");
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

export interface Rendered { subject: string; text: string; html: string }

const P = "margin:0 0 16px;font-size:16px;line-height:1.55;color:#0E1B2C";

/** Arma el email (texto + HTML de marca). Los valores de las variables se escapan en el HTML: un nombre con `<` no rompe nada. */
export function render(
  tpl: { subject: string; body: string; cta?: string },
  vars: Record<string, string>,
  opts: { unsubscribeUrl?: string } = {},
): Rendered {
  const subject = fill(tpl.subject, vars).replace(/[\r\n]+/g, " ").trim();
  const text = fill(tpl.body, vars) + (opts.unsubscribeUrl ? `\n\n—\nSi no querés recibir más novedades: ${opts.unsubscribeUrl}` : "");
  const hasButton = !!vars.link && !!tpl.cta && tpl.body.includes("{{link}}");
  const paragraphs = tpl.body.split(/\n{2,}/)
    .filter((p) => !(hasButton && p.trim() === "{{link}}")) // el botón reemplaza al enlace suelto
    .map((p) => `<p style="${P}">${fillHtml(p, vars).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2F6FB0">$1</a>')}</p>`)
    .join("");
  const button = hasButton
    ? `<p style="margin:24px 0"><a href="${esc(vars.link!)}" style="display:inline-block;background:#2F6FB0;color:#fff;padding:14px 26px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px">${esc(tpl.cta!)}</a></p><p style="font-size:12px;color:#6b7a8d;margin:0 0 8px">Si el botón no funciona, copiá este enlace en tu navegador:<br><span style="word-break:break-all">${esc(vars.link!)}</span></p>`
    : "";
  const foot = opts.unsubscribeUrl
    ? `<a href="${esc(opts.unsubscribeUrl)}" style="color:#6b7a8d">Dejar de recibir novedades</a>`
    : "Recibís este mensaje por tu cuenta de MiShowo.";
  const html = `<!doctype html><html lang="es-AR"><body style="margin:0;background:#EAF4FC;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif"><div style="max-width:520px;margin:auto"><p style="margin:0 0 14px;font-size:22px;font-weight:800;color:#0E1B2C">Mi<span style="color:#2F6FB0">Showo</span></p><div style="background:#fff;border-radius:20px;padding:28px 26px"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.2;color:#0E1B2C">${esc(subject)}</h1>${paragraphs}${button}</div><p style="margin:16px 4px 0;font-size:12px;color:#6b7a8d">${foot}</p></div></body></html>`;
  return { subject, text, html };
}
