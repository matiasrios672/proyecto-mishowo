/** Temas de la web de MiShowo (cabecera, menú del celular y pie). Archivo neutro: lo leen componentes de servidor y de cliente. */
export const NAV_LINKS: [string, string][] = [
  ["Cómo funciona", "/como-funciona"],
  ["Rubros", "/rubros"],
  ["Cuotas sin interés", "/cuotas"],
  ["Funciones", "/funciones"],
  ["Precios", "/precios"],
  ["Ayuda", "/ayuda"],
  ["Blog", "/blog"],
];

/** Cabecera: lo que más le interesa a quien todavía no es cliente, en orden de decisión: ver ejemplos, entender, qué incluye, cuánto cuesta. */
export const HEADER_LINKS: [string, string][] = [
  ["Ejemplos", "/rubros"],
  ["Cómo funciona", "/como-funciona"],
  ["Funciones", "/funciones"],
  ["Precios", "/precios"],
];
