// Plantillas por rubro con contenido de ejemplo argentino. Todo se marca como "Ejemplo" en el editor
// hasta que el dueño lo reemplaza. En la Épica 13 pasan a la DB para editarlas desde el admin.
export interface TemplateProduct { name: string; description: string; price: number; options?: { label: string; price?: number }[] }
export interface TemplateCategory { name: string; products: TemplateProduct[] }
export interface IndustryTemplate {
  id: string;
  name: string;
  blurb: string;
  mode: "productos" | "servicios";
  layout: "vidriera" | "mostrador" | "grilla" | "servicios";
  theme: string;
  fontPair: string;
  businessName: string;
  tagline: string;
  description: string;
  deliveryZone: string;
  eventDate: boolean;
  categories: TemplateCategory[];
}

export const INDUSTRIES: IndustryTemplate[] = [
  {
    id: "rotiseria", name: "Rotisería y comidas", blurb: "Empanadas, viandas, minutas", mode: "productos",
    layout: "mostrador", theme: "terracota", fontPair: "calida",
    businessName: "Rotisería Doña Marta", tagline: "Comida casera, hecha todos los días",
    description: "Empanadas al horno, milanesas y viandas del día. Pedí hasta las 11 y retirás al mediodía.",
    deliveryZone: "Retiro en el local o entrega en Villa Crespo y Caballito", eventDate: false,
    categories: [
      { name: "Empanadas", products: [
        { name: "Empanada de carne cortada a cuchillo", description: "Con cebolla de verdeo, huevo y aceituna.", price: 1800, options: [{ label: "Unidad" }, { label: "Media docena", price: 10200 }, { label: "Docena", price: 19200 }] },
        { name: "Empanada de jamón y queso", description: "Mucho queso, masa casera.", price: 1700 },
        { name: "Empanada de humita", description: "Choclo cremoso con cebolla y queso.", price: 1700 },
      ] },
      { name: "Platos del día", products: [
        { name: "Milanesa napolitana con puré", description: "Para una persona, con puré de papa.", price: 9500 },
        { name: "Tarta de zapallitos y queso", description: "Porción grande, con ensalada.", price: 6200 },
      ] },
    ],
  },
  {
    id: "bar", name: "Bar, café y restaurante", blurb: "Tu carta digital con QR para la mesa", mode: "productos",
    layout: "mostrador", theme: "terracota", fontPair: "calida",
    businessName: "Bar La Esquina", tagline: "Cocina de bodegón, cerveza tirada y buena música",
    description: "Minutas, pizzas y picadas para compartir. Escaneá el QR de la mesa, mirá la carta y pedí sin esperar. También hacemos pedidos para llevar.",
    deliveryZone: "Salón, vereda y retiro en el local. Delivery en un radio de 15 cuadras", eventDate: false,
    categories: [
      { name: "Para picar", products: [
        { name: "Picada para dos", description: "Jamón crudo, salame, quesos, aceitunas y pan casero.", price: 14800 },
        { name: "Rabas con alioli", description: "Crocantes, con limón.", price: 11500 },
        { name: "Provoleta a la parrilla", description: "Con orégano y ají molido.", price: 7900 },
      ] },
      { name: "Platos", products: [
        { name: "Milanesa napolitana con papas", description: "De ternera, jamón, queso y salsa de la casa.", price: 13900 },
        { name: "Hamburguesa de la esquina", description: "Doble carne, cheddar, panceta y papas rústicas.", price: 12400 },
        { name: "Ravioles de ricota", description: "Con salsa a elección: fileto, mixta o crema.", price: 10800, options: [{ label: "Fileto" }, { label: "Mixta", price: 11500 }, { label: "Crema", price: 11200 }] },
      ] },
      { name: "Pizzas", products: [
        { name: "Muzzarella", description: "Salsa de tomate, muzzarella y aceitunas.", price: 9800 },
        { name: "Fugazzeta rellena", description: "Cebolla, muzzarella y jamón.", price: 12600 },
      ] },
      { name: "Postres", products: [
        { name: "Flan casero con dulce de leche", description: "Con crema.", price: 5200 },
        { name: "Volcán de chocolate", description: "Con helado de crema americana.", price: 6900 },
      ] },
      { name: "Bebidas y tragos", products: [
        { name: "Cerveza tirada", description: "Rubia, roja o negra.", price: 4800, options: [{ label: "Pinta" }, { label: "Jarra", price: 9200 }] },
        { name: "Fernet con cola", description: "El clásico, con Coca-Cola.", price: 5600 },
        { name: "Limonada con menta y jengibre", description: "Natural, exprimida en el momento.", price: 3900 },
      ] },
    ],
  },
  {
    id: "ropa", name: "Tienda de ropa", blurb: "Indumentaria y accesorios", mode: "productos",
    layout: "grilla", theme: "rosa", fontPair: "moderna",
    businessName: "Luna Indumentaria", tagline: "Ropa cómoda para todos los días",
    description: "Remeras, buzos y jeans. Retiro por el local o entrega a coordinar. Consultá talles por WhatsApp.",
    deliveryZone: "Retiro en Palermo. Coordinamos entrega por WhatsApp", eventDate: false,
    categories: [
      { name: "Remeras y buzos", products: [
        { name: "Remera oversize de algodón", description: "Algodón peinado, lavado enzimático.", price: 18500, options: [{ label: "S" }, { label: "M" }, { label: "L" }] },
        { name: "Buzo canguro friza", description: "Friza invisible, interior suave.", price: 39900, options: [{ label: "M" }, { label: "L" }, { label: "XL" }] },
      ] },
      { name: "Pantalones", products: [
        { name: "Jean mom tiro alto", description: "Denim rígido, 5 bolsillos.", price: 46500, options: [{ label: "36" }, { label: "38" }, { label: "40" }, { label: "42" }] },
        { name: "Jogging recto", description: "Algodón, con cordón y bolsillos.", price: 29900 },
      ] },
    ],
  },
  {
    id: "muebles", name: "Muebles y deco", blurb: "Muebles a medida, decoración", mode: "productos",
    layout: "vidriera", theme: "marfil", fontPair: "clasica",
    businessName: "Taller Nogal Muebles", tagline: "Muebles de madera, hechos a tu medida",
    description: "Fabricamos mesas, bibliotecas y placares en madera maciza y melamina. Presupuesto sin cargo.",
    deliveryZone: "Entrega e instalación en GBA. Interior, a coordinar", eventDate: false,
    categories: [
      { name: "Living y comedor", products: [
        { name: "Mesa ratona de paraíso", description: "90 x 50 cm, terminación natural con laca mate.", price: 185000 },
        { name: "Biblioteca con 5 estantes", description: "Pino macizo, 180 x 80 cm.", price: 240000 },
      ] },
      { name: "Dormitorio", products: [
        { name: "Mesa de luz flotante", description: "Con cajón, en melamina símil roble.", price: 68000 },
        { name: "Cabecero tapizado", description: "Para cama de 2 plazas, lino a elección.", price: 125000 },
      ] },
    ],
  },
  {
    id: "eventos", name: "Eventos y alquileres", blurb: "Mesas, sillas, livings, vajilla", mode: "productos",
    layout: "vidriera", theme: "medianoche", fontPair: "moderna",
    businessName: "Fiestas Don Pepe", tagline: "Alquiler de mobiliario para tu evento",
    description: "Mesas, sillas y livings para cumpleaños, casamientos y eventos. Reservá tu fecha con tiempo.",
    deliveryZone: "Entrega y retiro en zona oeste. Consultá otras zonas", eventDate: true,
    categories: [
      { name: "Mobiliario", products: [
        { name: "Silla Tiffany blanca", description: "Precio por unidad por día.", price: 2500 },
        { name: "Mesa rectangular 1,80 m", description: "Para 8 personas, incluye mantel blanco.", price: 9000 },
        { name: "Living vintage (2 sillones + mesa)", description: "Ideal para recepción o sector de fotos.", price: 65000 },
      ] },
      { name: "Vajilla", products: [
        { name: "Set de vajilla x 50 personas", description: "Plato, cubiertos y copa.", price: 55000 },
      ] },
    ],
  },
  {
    id: "gimnasio", name: "Gimnasio y entrenamiento", blurb: "Clases, pases y entrenadores", mode: "servicios",
    layout: "servicios", theme: "carbon", fontPair: "moderna",
    businessName: "Fuerza Box Club", tagline: "Entrená a tu ritmo, con acompañamiento",
    description: "Funcional, boxeo y musculación con profes que te corrigen. Primera clase de prueba sin cargo.",
    deliveryZone: "Av. Rivadavia 4500, Almagro", eventDate: false,
    categories: [
      { name: "Planes mensuales", products: [
        { name: "Pase libre", description: "Acceso a todas las clases y sala de musculación.", price: 38000 },
        { name: "3 veces por semana", description: "Elegís tus días y horarios.", price: 29000 },
      ] },
      { name: "Clases sueltas", products: [
        { name: "Clase de prueba", description: "Sin cargo, con turno previo.", price: 0 },
        { name: "Clase suelta de boxeo", description: "Duración 60 minutos.", price: 6500 },
      ] },
    ],
  },
  {
    id: "oficios", name: "Oficios del hogar", blurb: "Plomería, electricidad, gas, pintura", mode: "servicios",
    layout: "servicios", theme: "nogal", fontPair: "limpia",
    businessName: "Plomería Rodríguez", tagline: "Soluciones rápidas para tu casa",
    description: "Plomero matriculado. Destapaciones, pérdidas, instalación de termotanques y griferías. Presupuesto sin cargo.",
    deliveryZone: "Atiendo en CABA y zona sur", eventDate: false,
    categories: [
      { name: "Servicios", products: [
        { name: "Visita y presupuesto", description: "Revisión en tu domicilio sin compromiso.", price: 0 },
        { name: "Destapación de cañerías", description: "Con máquina, cocina o baño.", price: 45000 },
        { name: "Instalación de grifería", description: "Mano de obra, no incluye la pieza.", price: 28000 },
        { name: "Cambio de termotanque", description: "Retiro del viejo e instalación del nuevo.", price: 60000 },
      ] },
    ],
  },
  {
    id: "belleza", name: "Belleza y estética", blurb: "Uñas, peluquería, depilación", mode: "servicios",
    layout: "servicios", theme: "rosa", fontPair: "calida",
    businessName: "Estudio Aura Nails", tagline: "Uñas prolijas, turnos puntuales",
    description: "Esmaltado semipermanente, esculpidas y nail art. Reservá tu turno por WhatsApp.",
    deliveryZone: "Atiendo con turno en Belgrano. Tolerancia de 10 minutos", eventDate: false,
    categories: [
      { name: "Manos", products: [
        { name: "Esmaltado semipermanente", description: "Incluye limado y cutícula. Dura hasta 3 semanas.", price: 14000 },
        { name: "Uñas esculpidas en gel", description: "Con diseño simple a elección.", price: 26000 },
        { name: "Retiro de esmaltado", description: "Sin daño a la uña natural.", price: 5000 },
      ] },
      { name: "Pies", products: [
        { name: "Belleza de pies", description: "Spa de pies con esmaltado semipermanente.", price: 17000 },
      ] },
    ],
  },
  {
    id: "salud", name: "Salud y profesionales", blurb: "Psicología, nutrición, kinesiología", mode: "servicios",
    layout: "servicios", theme: "glaciar", fontPair: "limpia",
    businessName: "Lic. Sofía Benítez · Nutrición", tagline: "Alimentación sin dietas imposibles",
    description: "Consultas presenciales y online. Planes alimentarios personalizados y seguimiento semanal.",
    deliveryZone: "Consultorio en Caballito y atención online", eventDate: false,
    categories: [
      { name: "Consultas", products: [
        { name: "Primera consulta", description: "Evaluación completa y plan inicial. 60 minutos.", price: 30000 },
        { name: "Control de seguimiento", description: "Ajuste del plan. 30 minutos.", price: 20000 },
        { name: "Consulta online", description: "Por videollamada, con plan por mail.", price: 24000 },
      ] },
    ],
  },
  {
    id: "otro-productos", name: "Otro rubro: vendo productos", blurb: "Armá tu catálogo desde cero", mode: "productos",
    layout: "grilla", theme: "blanco", fontPair: "moderna",
    businessName: "Mi Negocio", tagline: "Todo lo que necesitás, en un solo lugar",
    description: "Contá en pocas palabras qué vendés y por qué elegirte.",
    deliveryZone: "Retiro por el local o entrega a coordinar", eventDate: false,
    categories: [
      { name: "Productos", products: [
        { name: "Producto de ejemplo 1", description: "Descripción corta de tu producto.", price: 10000 },
        { name: "Producto de ejemplo 2", description: "Contá medidas, materiales o sabores.", price: 15000 },
      ] },
    ],
  },
  {
    id: "otro-servicios", name: "Otro rubro: ofrezco servicios", blurb: "Armá tu lista de servicios", mode: "servicios",
    layout: "servicios", theme: "blanco", fontPair: "limpia",
    businessName: "Mi Servicio", tagline: "Un servicio de confianza, a tu medida",
    description: "Contá qué hacés, cómo trabajás y en qué zona atendés.",
    deliveryZone: "Zona de atención a coordinar", eventDate: false,
    categories: [
      { name: "Servicios", products: [
        { name: "Servicio de ejemplo 1", description: "Qué incluye y cuánto dura.", price: 20000 },
        { name: "Servicio de ejemplo 2", description: "Para quién es ideal.", price: 35000 },
      ] },
    ],
  },
];

export const getIndustry = (id: string) => INDUSTRIES.find((i) => i.id === id) ?? null;
