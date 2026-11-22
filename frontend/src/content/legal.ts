// Textos legales base. IMPORTANTE: son un punto de partida; el titular debe completar sus datos
// (razón social, CUIT, domicilio, email de contacto) con NEXT_PUBLIC_LEGAL_ENTITY y hacerlos revisar por un abogado.
export const LEGAL_ENTITY = process.env.NEXT_PUBLIC_LEGAL_ENTITY ?? "MiShowo";
export const LEGAL_UPDATED = "22 de noviembre de 2026";

export interface LegalDoc { slug: string; title: string; description: string; body: string }

export const LEGAL: LegalDoc[] = [
  {
    slug: "terminos",
    title: "Términos y condiciones",
    description: "Las reglas para usar MiShowo.",
    body: `# 1. Qué es MiShowo

MiShowo (${LEGAL_ENTITY}) es un servicio que permite a emprendedores y comercios crear una página web con catálogo, recibir pedidos por WhatsApp y compartir un link propio. Al crear una cuenta o usar el servicio aceptás estos términos.

# 2. Tu cuenta

Sos responsable de la información que cargás y de mantener segura tu contraseña. Tenés que ser mayor de edad o contar con autorización para contratar. Podemos suspender cuentas que incumplan estos términos.

# 3. Tu contenido

Los textos, precios, fotos y datos de tu página son tuyos y sos el único responsable de su veracidad y de tener derecho a usarlos. No podés publicar contenido ilegal, engañoso, que infrinja derechos de terceros, que sea ofensivo o que promueva actividades prohibidas. Podemos despublicar páginas que lo hagan, previa denuncia o revisión.

# 4. Pedidos y ventas

MiShowo es una herramienta: la venta es un acuerdo entre vos y tu cliente. No intervenimos en el pago, la entrega ni los reclamos, y no cobramos comisión por tus ventas. Vos sos responsable de cumplir con tus obligaciones frente a tus clientes, incluidas las impositivas.

# 5. Planes y pagos

Hay un plan gratuito y planes pagos con los precios publicados en el sitio. El pago se realiza por transferencia y se confirma manualmente. El plan se activa con una fecha de vencimiento; al vencer, la cuenta pasa al plan gratuito. Podemos modificar los precios con aviso previo, sin afectar los períodos ya pagados.

# 6. Disponibilidad

Hacemos lo posible para que el servicio esté siempre disponible, pero no garantizamos que funcione sin interrupciones. Podemos realizar tareas de mantenimiento.

# 7. Limitación de responsabilidad

En la máxima medida permitida por la ley, MiShowo no responde por daños indirectos, lucro cesante ni pérdidas derivadas del uso del servicio o del contenido publicado por los usuarios.

# 8. Cambios y ley aplicable

Podemos actualizar estos términos y te avisaremos de los cambios importantes. Se rigen por las leyes de la República Argentina; cualquier conflicto se somete a los tribunales competentes. Para consultas escribinos desde el [formulario de contacto](/contacto).`,
  },
  {
    slug: "privacidad",
    title: "Política de privacidad",
    description: "Qué datos tratamos, para qué y cuáles son tus derechos.",
    body: `# Quién es responsable

El responsable del tratamiento de los datos es ${LEGAL_ENTITY}. Tratamos los datos personales de acuerdo con la **Ley 25.326 de Protección de los Datos Personales** de la República Argentina.

# Qué datos recopilamos

- **De tu cuenta:** email, nombre (opcional) y contraseña, que se guarda cifrada.
- **De tu negocio:** nombre, descripción, productos, precios, horarios, WhatsApp, dirección, fotos y diseño.
- **De los pedidos:** el nombre, el teléfono y las aclaraciones que tus clientes escriben al hacer un pedido.
- **De uso:** estadísticas básicas de visitas a las páginas, sin cookies de terceros ni herramientas externas de seguimiento.

# Para qué los usamos

Para prestar el servicio, mostrar tu página, registrar tus pedidos, enviarte avisos de tu cuenta (confirmación de email, planes, pagos) y mejorar el producto. No vendemos datos personales.

# Con quién los compartimos

Solo con proveedores que nos permiten operar (hosting y envío de emails), bajo obligación de confidencialidad. Los datos de tus pedidos son tuyos: solo vos los ves en tu panel.

# Tus derechos

Podés pedir acceso, rectificación, actualización y supresión de tus datos personales. El titular de los datos tiene la facultad de ejercer el derecho de acceso en forma gratuita a intervalos no inferiores a seis meses (art. 14, Ley 25.326). La **Agencia de Acceso a la Información Pública** es el órgano de control de la Ley 25.326 y tiene la atribución de atender denuncias y reclamos por incumplimientos.

Para ejercer tus derechos escribinos desde el [formulario de contacto](/contacto).

# Conservación y seguridad

Conservamos los datos mientras tengas una cuenta. Si eliminás tu negocio, lo conservamos 30 días por si querés recuperarlo y luego se borra. Protegemos los datos con conexiones cifradas y acceso restringido.`,
  },
  {
    slug: "cancelacion",
    title: "Política de cancelación",
    description: "Cómo cancelar tu plan y qué pasa después.",
    body: `# Cancelar un plan pago

Podés cancelar cuando quieras. Tu plan sigue activo hasta que termine el período que ya pagaste y después tu cuenta pasa al plan gratuito. No se renueva solo: cada renovación la confirmás vos con tu pago.

# Reintegros

Los períodos ya pagados no se reintegran de forma proporcional. La excepción es el derecho de arrepentimiento: tenés **10 días corridos** desde la contratación para solicitar la cancelación y el reintegro del pago, usando el [botón de arrepentimiento](/arrepentimiento).

# Qué pasa con tu página

Al pasar al plan gratuito tu página sigue publicada con las condiciones de ese plan. Si tenías más productos que el límite del plan gratuito, no se borran: quedan guardados, pero no se podrán sumar nuevos hasta que vuelvas a un plan pago.

# Eliminar tu cuenta

Podés pedir que eliminemos tu cuenta y tus datos. Tu página deja de estar publicada y la información se conserva 30 días antes de borrarse definitivamente.`,
  },
];

export const getLegal = (slug: string) => LEGAL.find((d) => d.slug === slug) ?? null;
