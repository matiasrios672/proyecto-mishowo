import type { EditorTab } from "./score";

/** Módulos del panel que usan el editor. `all` es el editor completo y guiado (primera vez y quien aún no tiene cuenta). */
export type EditorModule = "all" | "catalogo" | "pagina" | "ajustes";

export const MODULE_TABS: Record<EditorModule, EditorTab[]> = {
  all: ["negocio", "textos", "fotos", "productos", "pedidos", "diseno", "seo", "publicar"],
  catalogo: ["productos", "fotos"],
  pagina: ["textos", "fotos", "diseno", "seo", "publicar"],
  ajustes: ["negocio", "pedidos"],
};

export const MODULE_ROUTE: Record<Exclude<EditorModule, "all">, string> = {
  catalogo: "/panel/catalogo",
  pagina: "/panel/pagina",
  ajustes: "/panel/ajustes",
};

export const MODULE_TITLE: Record<EditorModule, string> = {
  all: "Editor",
  catalogo: "Catálogo",
  pagina: "Mi página",
  ajustes: "Ajustes del negocio",
};

/** Dónde vive cada pestaña cuando se usa el panel por módulos. */
export function moduleOf(tab: EditorTab): Exclude<EditorModule, "all"> {
  if (tab === "productos") return "catalogo";
  if (tab === "negocio" || tab === "pedidos") return "ajustes";
  return "pagina";
}

export const isTab = (v: string | null | undefined): v is EditorTab => !!v && MODULE_TABS.all.includes(v as EditorTab);
