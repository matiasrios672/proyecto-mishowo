// Plantillas de email: el texto por defecto vive acá y el sysadmin lo puede pisar desde /admin/emails (tabla email_templates).
// Las variables van entre llaves dobles: {{link}}. Una variable que no existe se reemplaza por vacío.
export interface TemplateDef {
  key: string;
  name: string;
  description: string;
  /** Cuándo se manda (se muestra en el admin). */
  trigger: string;
  group: "cuenta" | "planes" | "turnos" | "soporte" | "equipo" | "comunicados";
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
    body: "¡Bienvenido a MiShowo!\n\nUn último paso: confirmá tu email para poder publicar tu página y recibir avisos importantes.\n\n{{link}}\n\nEl enlace vale 24 horas. Si no creaste una cuenta, ignorá este mensaje: nadie va a poder usarla sin confirmar." },
  { key: "welcome", name: "Bienvenida", group: "cuenta", trigger: "Cuando la persona confirma su email.", cta: "Ir a mi panel",
    description: "Primeros pasos después de confirmar. Se puede apagar.", vars: [{ name: "link", example: "https://mishowo.com/panel", help: "Enlace a su panel" }],
    subject: "¡Listo! Tu cuenta de MiShowo está confirmada",
    body: "Ya podés publicar tu página.\n\n**Tres pasos rápidos para salir al aire:**\n\n- Cargá tus productos o servicios con foto y precio.\n- Elegí el diseño y el color de tu marca.\n- Publicá tu link y ponelo en tu bio de Instagram y en tu estado de WhatsApp.\n\n{{link}}\n\nSi necesitás ayuda, respondé este mail: te contestamos personalmente." },
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
    body: "Confirmamos tu pago. Tu plan **{{plan}}** está activo hasta el **{{until}}**.\n\nYa podés usar todas las herramientas del plan desde tu panel. Unos días antes del vencimiento te avisamos para que renueves sin apuros.\n\nGracias por elegir MiShowo." },
  { key: "payment_rejected", name: "Pago no confirmado", group: "planes", trigger: "Cuando el equipo rechaza un pago.",
    description: "Explica el motivo y cómo reintentar.", vars: [{ name: "reason", example: "El comprobante no se ve", help: "Motivo que cargó el equipo" }],
    subject: "No pudimos confirmar tu pago",
    body: "No pudimos confirmar tu pago.\n\nMotivo: {{reason}}\n\nPodés volver a avisar tu pago desde la sección de planes, o escribirnos para resolverlo." },
  { key: "plan_expiring", name: "Tu plan está por vencer", group: "planes", trigger: "Una vez, unos días antes del vencimiento (los días se configuran en Automatizaciones).",
    description: "Recordatorio de renovación.", vars: [{ name: "date", example: "30/11/2026", help: "Fecha de vencimiento" }],
    subject: "Tu plan de MiShowo está por vencer",
    body: "Tu plan vence el **{{date}}**.\n\nPara mantenerlo, avisanos tu pago desde la sección «Plan y pagos» de tu panel antes de esa fecha. Pagás por transferencia y sin comisión por tus ventas.\n\nSi no lo renovás, tu página pasa al plan gratuito y sigue publicada: no perdés ningún dato." },
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

  // Puntos de partida para armar comunicados (Emails → Comunicados → «Empezar desde una plantilla»). No salen solas.
  { key: "news_update", name: "Novedades del producto", group: "comunicados", trigger: "A mano, desde Comunicados.", description: "Para contar una función nueva a todos los usuarios.", vars: [{ name: "name", example: "Lupe", help: "Nombre de quien lo recibe" }],
    subject: "Novedades en MiShowo: {{name}}, mirá lo que sumamos",
    body: "Hola {{name}},\n\nEste mes sumamos mejoras pensadas para que vendas más desde tu página:\n\n- **Qué es lo nuevo:** contalo en una frase.\n- **Por qué te sirve:** el beneficio concreto para tu negocio.\n- **Cómo se usa:** dónde lo encontrás en tu panel.\n\nProbalo hoy y contanos qué te parece respondiendo este mail." },
  { key: "promo_plan", name: "Promoción de plan", group: "comunicados", trigger: "A mano, desde Comunicados.", description: "Para impulsar el paso a un plan pago.", vars: [{ name: "name", example: "Lupe", help: "Nombre de quien lo recibe" }],
    subject: "{{name}}, llevá tu página al siguiente nivel",
    body: "Hola {{name}},\n\nTu página ya está en marcha. Con un plan pago sumás herramientas para vender más:\n\n- Más productos y fotos por producto.\n- Estadísticas completas para ver qué funciona.\n- Turnos, cupones y reseñas de clientes.\n\nPagás por transferencia y sin comisión por venta. Escribinos respondiendo este mail y te ayudamos a elegir." },
  { key: "tips_catalog", name: "Consejos para vender más", group: "comunicados", trigger: "A mano, desde Comunicados.", description: "Contenido útil para mantener la relación con quienes ya publicaron.", vars: [{ name: "name", example: "Lupe", help: "Nombre de quien lo recibe" }],
    subject: "3 cosas que hacen que tu página venda más",
    body: "Hola {{name}},\n\nLas páginas que más consultas reciben tienen esto en común:\n\n- **Fotos claras y propias** de cada producto.\n- **Precios al día** y platos o stock agotado marcado.\n- **El link en todos lados:** bio de Instagram, estado de WhatsApp y un cartel con QR en el local.\n\nRevisá tu página con esta lista y mirá cómo sube tu número de visitas en Estadísticas." },
  { key: "reactivate", name: "Volvé a tu página", group: "comunicados", trigger: "A mano, desde Comunicados.", description: "Para quienes dejaron de entrar.", vars: [{ name: "name", example: "Lupe", help: "Nombre de quien lo recibe" }],
    subject: "{{name}}, tu página te está esperando",
    body: "Hola {{name}},\n\nHace un tiempo que no entrás a MiShowo. Tu página sigue ahí y retomarla lleva pocos minutos.\n\nSi algo no te cerró o te trabaste con alguna parte, respondé este mail y lo resolvemos juntos." },
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

/** Dirección pública de la web (para el logo y los links de marca de los mails). Se fija una vez al arrancar el servidor. */
let brandBase = "https://mishowo.com";
export function setMailBrand(baseUrl: string) { brandBase = baseUrl.replace(/\/$/, ""); }

const INK = "#0E1B2C", ORANGE = "#FC5502";
const P = `margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}`;
const A = `color:#C73E00;font-weight:600`;

/** Un párrafo del cuerpo: lista con viñetas si todas las líneas empiezan con «- » o «• »; si no, texto con **negrita** y links. */
function paragraphHtml(raw: string, vars: Record<string, string>): string {
  const inline = (t: string) => fillHtml(t, vars).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="${A}">$1</a>`);
  const lines = raw.split("\n");
  if (lines.every((l) => /^\s*[-•]\s+/.test(l)))
    return `<ul style="margin:0 0 16px;padding:0 0 0 22px;font-size:16px;line-height:1.6;color:${INK}">${lines.map((l) => `<li style="margin:0 0 6px">${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("")}</ul>`;
  return `<p style="${P}">${inline(raw).replace(/\n/g, "<br>")}</p>`;
}

/** Arma el email (texto + HTML con la identidad de MiShowo). Los valores de las variables se escapan en el HTML: un nombre con `<` no rompe nada. */
export function render(
  tpl: { subject: string; body: string; cta?: string },
  vars: Record<string, string>,
  opts: { unsubscribeUrl?: string } = {},
): Rendered {
  const subject = fill(tpl.subject, vars).replace(/[\r\n]+/g, " ").trim();
  const text = fill(tpl.body, vars).replace(/\*\*([^*]+)\*\*/g, "$1") + (opts.unsubscribeUrl ? `\n\n—\nSi no querés recibir más novedades: ${opts.unsubscribeUrl}` : "") + "\n\nHecho por MiShowo";
  const hasButton = !!vars.link && !!tpl.cta && tpl.body.includes("{{link}}");
  const paragraphs = tpl.body.split(/\n{2,}/)
    .filter((p) => !(hasButton && p.trim() === "{{link}}")) // el botón reemplaza al enlace suelto
    .map((p) => paragraphHtml(p, vars))
    .join("");
  const button = hasButton
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 8px"><tr><td style="background:${ORANGE};border-radius:12px"><a href="${esc(vars.link!)}" style="display:inline-block;padding:15px 30px;color:${INK};text-decoration:none;font-weight:800;font-size:16px">${esc(tpl.cta!)}</a></td></tr></table><p style="margin:0 0 4px;font-size:12px;color:#6B7280">Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br><a href="${esc(vars.link!)}" style="${A};word-break:break-all;font-weight:400">${esc(vars.link!)}</a></p>`
    : "";
  const foot = opts.unsubscribeUrl
    ? `<a href="${esc(opts.unsubscribeUrl)}" style="color:#6B7280">Dejar de recibir novedades</a>`
    : "Recibís este mensaje porque tenés una cuenta en MiShowo.";
  const html = `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body style="margin:0;background:#F6F7F9;padding:24px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">`
    + `<div style="max-width:560px;margin:auto"><div style="background:${INK};border-radius:20px 20px 0 0;padding:22px 28px"><a href="${esc(brandBase)}" style="text-decoration:none"><img src="${esc(brandBase)}/brand/logo-claro.png" alt="MiShowo" width="150" height="26" style="display:block;border:0;height:26px;width:auto;color:#fff;font-size:22px;font-weight:800"></a></div>`
    + `<div style="height:5px;background:linear-gradient(90deg,#FFB000,#FF8A00 40%,${ORANGE})"></div>`
    + `<div style="background:#fff;border-radius:0 0 20px 20px;padding:30px 28px 26px;box-shadow:0 12px 30px -18px rgba(14,27,44,.35)"><h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;color:${INK};letter-spacing:-.01em">${esc(subject)}</h1>${paragraphs}${button}`
    + `<p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #EEF0F3;font-size:13px;color:#6B7280">¿Dudas? Respondé este mail y te ayudamos.</p></div>`
    + `<p style="margin:16px 6px 0;font-size:12px;line-height:1.5;color:#6B7280">${foot}<br>Hecho por <a href="${esc(brandBase)}" style="color:#6B7280;font-weight:700">MiShowo</a>.</p></div></body></html>`;
  return { subject, text, html };
}
