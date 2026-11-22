export interface HelpArticle { slug: string; title: string; description: string; body: string }

export const HELP: HelpArticle[] = [
  {
    slug: "como-crear-tu-pagina",
    title: "Cómo crear tu página",
    description: "De cero a tu link en pocos minutos, desde el celular.",
    body: `# Empezá eligiendo tu rubro

Entrá a [Crear mi página](/crear) y elegí el rubro que más se parezca a tu negocio. Te armamos una página de ejemplo con productos y textos para que veas cómo queda. Todo lo que aparece con la etiqueta **Ejemplo** lo reemplazás por lo tuyo.

# Completá lo básico

En la pestaña **Negocio** cargá el nombre, tu WhatsApp (con código de área y sin el 15), tus horarios y la zona de entrega. Ves el resultado en vivo a la derecha, o con el botón "Ver cómo queda" si estás en el celular.

# Guardá tu página

No necesitás cuenta para probar. Cuando quieras guardar o subir fotos, tocá **Guardar mi página** y creá tu cuenta: tu borrador se guarda solo.`,
  },
  {
    slug: "como-cargar-productos",
    title: "Cómo cargar productos y servicios",
    description: "Uno por uno, pegando una lista o con un archivo CSV.",
    body: `# De a uno

En la pestaña **Productos** tocá "Agregar producto". Poné nombre, descripción y precio. Si querés que se agote solo, cargá el **stock**.

# Con opciones

Para talles, colores o tamaños, usá **Opciones**: escribí los valores separados por coma ("S, M, L") y tocá "Generar opciones". Podés poner un precio distinto en cada una.

# Varios de una vez

Tocá **Cargar varios** y pegá una lista, una línea por producto:

- Empanada de carne - 1800
- Jamón y queso $1.700

Una línea que termina en dos puntos crea una categoría. También podés subir un archivo CSV con las columnas nombre, descripción, precio y categoría.`,
  },
  {
    slug: "como-cambiar-el-diseno",
    title: "Cómo cambiar el diseño y los colores",
    description: "Cuatro diseños, nueve estilos y el color de tu marca.",
    body: `# Elegí un diseño

En la pestaña **Diseño** hay cuatro opciones: Vidriera (fotos grandes), Mostrador (lista compacta), Grilla (tienda) y Servicios. Te recomendamos el que mejor va con tu contenido. Con "Comparar diseños" los ves lado a lado.

# Colores y tipografía

Elegí uno de los nueve estilos y una tipografía. Si tenés el color de tu marca, ponelo a mano o subí tu logo y lo detectamos solo.

No se pierde nada al cambiar de diseño: tus productos y textos son los mismos.`,
  },
  {
    slug: "como-recibir-pedidos",
    title: "Cómo recibir pedidos",
    description: "Qué ve tu cliente y cómo te llega cada pedido.",
    body: `# Qué hace tu cliente

Elige productos, arma su pedido y toca "Enviar pedido por WhatsApp". Se abre WhatsApp con el mensaje armado: productos, cantidades, total y aclaraciones.

# Qué te llega

El mensaje llega a tu WhatsApp. Además, cada pedido queda registrado con su número. El pago y la entrega los coordinás directamente con tu cliente.

# Personalizá el mensaje

En la pestaña **Pedidos** podés cambiar el saludo inicial, mostrar u ocultar las cantidades y pedir la fecha del evento (útil para alquileres).`,
  },
  {
    slug: "planes-y-pagos",
    title: "Planes y cómo pagar",
    description: "Cómo cambiar de plan y confirmar tu pago por transferencia.",
    body: `# Cambiar de plan

Entrá a la sección de planes, elegí el que te sirva y mirá los datos para transferir. Hacé la transferencia y tocá **Ya pagué** para subir tu comprobante.

# Confirmación

Revisamos tu comprobante y activamos el plan con su fecha de vencimiento. Te avisamos por email. Unos días antes de que venza te mandamos un recordatorio.

# Si no renovás

Tu página pasa al plan gratuito y sigue online. Tus productos y datos se conservan.`,
  },
  {
    slug: "olvide-mi-contrasena",
    title: "Olvidé mi contraseña",
    description: "Cómo volver a entrar a tu cuenta.",
    body: `# Restablecela por email

Entrá a [Recuperar contraseña](/recuperar), escribí tu email y te mandamos un enlace para elegir una nueva. El enlace vale 1 hora.

# Entrar sin contraseña

También podés usar [Ingresar](/ingresar) y elegir "Con un enlace al email": te mandamos un enlace de acceso que vale 15 minutos y se usa una sola vez.

Por seguridad, al cambiar la contraseña cerramos tus sesiones abiertas en otros dispositivos.`,
  },
];

export const getHelp = (slug: string) => HELP.find((a) => a.slug === slug) ?? null;
