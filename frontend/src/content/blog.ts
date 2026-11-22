export interface Article { slug: string; title: string; description: string; date: string; minutes: number; body: string }

// Artículos semilla del blog (SEO). Se editan acá hasta que el admin tenga el mini CMS (Épica 13).
export const BLOG: Article[] = [
  {
    slug: "como-sacar-buenas-fotos-de-tus-productos-con-el-celular",
    title: "Cómo sacar buenas fotos de tus productos con el celular",
    description: "Luz, fondo y encuadre: tres cambios simples para que tus productos se vean profesionales sin comprar equipo.",
    date: "2026-11-18",
    minutes: 4,
    body: `Una buena foto vende más que una descripción larga. La buena noticia: no necesitás cámara profesional, alcanza con tu celular y tres cuidados.

# 1. Buscá luz natural

Sacá las fotos cerca de una ventana, de día. Evitá el flash: aplana los colores y marca sombras duras. Si el sol pega fuerte, poné una cortina fina o una hoja blanca entre la ventana y el producto.

# 2. Elegí un fondo limpio

Un mantel liso, una cartulina o una mesa de madera clara alcanzan. Sacá todo lo que no sea el producto. Si vendés ropa, colgala de una percha contra una pared lisa o apoyala sobre una superficie plana.

# 3. Mostrá el producto de varios lados

- Una foto general, con el producto entero.
- Una de cerca, con el detalle que lo hace especial (la textura, el relleno, el bordado).
- Una con escala: una mano, una mesa o algo que ayude a ver el tamaño.

# Antes de subirlas

Limpiá la lente con un trapito, mantené el celular derecho y tocá la pantalla en el producto para enfocar. En **MiShowo** las fotos se optimizan solas al subirlas, así que no te preocupes por el peso.

Cuando tengas tus fotos, [armá tu página gratis](/crear) y probá cómo quedan.`,
  },
  {
    slug: "que-poner-en-la-bio-de-instagram-de-tu-negocio",
    title: "Qué poner en la bio de Instagram de tu negocio",
    description: "La bio tiene pocos caracteres y un solo link. Cómo aprovecharlos para que quien llega te pueda comprar.",
    date: "2026-11-19",
    minutes: 3,
    body: `Tu bio es lo primero que ve alguien que llega a tu perfil. Tiene muy poco espacio, así que cada línea tiene que cumplir una función.

# Decí qué vendés y dónde

La primera línea tiene que responder: ¿qué hacés? Por ejemplo, "Empanadas caseras al horno · Villa Crespo". Quien no te conoce tiene que entenderlo en dos segundos.

# Contá cómo comprar

Poné una instrucción clara: "Pedí por el link 👇" o "Hacé tu pedido hasta las 11". Una indicación concreta convierte mejor que una frase linda.

# Usá el link para todo lo demás

Instagram te deja un solo link, y ahí está la oportunidad. En vez de mandar a un chat vacío, mandá a tu **página de MiShowo**: ahí tus clientes ven el catálogo, los precios, los horarios y arman su pedido, que te llega por WhatsApp ya ordenado.

# Un ejemplo completo

- Rotisería casera en Villa Crespo
- Empanadas, viandas y tartas
- Pedí hasta las 11 y retirás al mediodía
- mishowo.com/tunegocio

Ya tenés todo lo que necesitás. [Creá tu página](/crear) y copiá tu link.`,
  },
  {
    slug: "como-armar-tu-lista-de-precios-sin-confundir-a-tus-clientes",
    title: "Cómo armar tu lista de precios sin confundir a tus clientes",
    description: "Ordená tus productos en categorías, nombrá bien las opciones y mostrá los precios de forma clara para vender más.",
    date: "2026-11-20",
    minutes: 4,
    body: `Una lista de precios confusa te hace perder ventas: si tu cliente tiene que preguntar, muchas veces no pregunta y se va. Estos consejos ayudan a que se entienda a la primera.

# Agrupá en categorías

En vez de una lista larga, separá por tipo: "Empanadas", "Platos del día", "Postres". Es más fácil de recorrer y, en tu página de MiShowo, cada categoría tiene su propio acceso en el menú.

# Nombrá bien cada producto

Poné el nombre que usaría tu cliente al pedir. "Empanada de carne cortada a cuchillo" dice más que "Emp. carne". Sumá una descripción corta con lo que lo hace distinto.

# Usá opciones, no productos repetidos

Si vendés lo mismo en distintas cantidades o tamaños, no cargues tres productos. Usá **opciones**: "Unidad", "Media docena", "Docena", cada una con su precio. Lo mismo para talles y colores.

# Mostrá las ofertas con precio tachado

Si un producto está en promo, cargá el precio anterior como precio tachado. Tu página muestra el descuento y se entiende al instante.

# Revisá los precios seguido

Un precio viejo genera discusiones. Cuando cambie algo, actualizalo en el momento: los cambios se ven enseguida en tu página.

Si ya tenés tu lista en el celular, podés pegarla completa y cargar todo de una vez. [Probalo gratis](/crear).`,
  },
];

export const getArticle = (slug: string) => BLOG.find((a) => a.slug === slug) ?? null;
