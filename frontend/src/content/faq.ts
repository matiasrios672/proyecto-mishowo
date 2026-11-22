// Preguntas frecuentes por defecto de la landing. El admin puede reemplazarlas desde "Contenido" (se guardan en la base);
// si no cargó ninguna, o si la API no responde, se usan estas.
export interface FaqItem { q: string; a: string }

export const DEFAULT_FAQ: FaqItem[] = [
  { q: "¿Cuánto cuesta?", a: "Podés empezar gratis, sin tarjeta. Si tu negocio crece, hay planes con más productos y herramientas. Los precios están en esta página, siempre actualizados." },
  { q: "¿Necesito saber de tecnología?", a: "No. Elegís un rubro, cambiás lo que quieras y ves el resultado en vivo. Si sabés usar WhatsApp, sabés usar MiShowo." },
  { q: "¿Cómo me llegan los pedidos?", a: "Por WhatsApp, con el pedido armado: productos, cantidades, total y aclaraciones. Además queda registrado en tu panel." },
  { q: "¿Cómo cobro?", a: "El pago lo coordinás directamente con tu cliente (transferencia, efectivo, como prefieras). MiShowo no cobra comisión por tus ventas." },
  { q: "¿Puedo usar mi propio dominio?", a: "Cada negocio tiene su link tunegocio.mishowo.com. Los dominios propios van a estar disponibles más adelante." },
  { q: "¿Qué pasa con los datos de mis clientes?", a: "Son tuyos. Los tratamos según la Ley 25.326 de Protección de Datos Personales y podés pedirnos acceso o eliminación cuando quieras." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí. Si cancelás un plan pago, tu página sigue activa hasta que termine el período y después pasa al plan gratuito." },
];
