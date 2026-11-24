// Una cuenta puede tener varias páginas, cada una con su plan. La que está abierta en el panel se guarda en el navegador
// y viaja en el encabezado `x-business-id` de cada pedido a /me/*. «new» = crear una página nueva en el próximo guardado.
import { clearDraft } from "./draft";

const KEY = "mishowo:page:v1";
export const NEW_PAGE = "new";

export function getActivePage(): string | null {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(KEY); } catch { return null; }
}
export function setActivePage(id: string | null) {
  try { if (id) window.localStorage.setItem(KEY, id); else window.localStorage.removeItem(KEY); } catch { /* sin storage: queda la primera página */ }
}

/** Cambia de página: se suelta el borrador local (es de la anterior) para que el editor abra la de la cuenta. */
export function switchPage(id: string | null) {
  setActivePage(id);
  clearDraft();
  try { window.localStorage.removeItem("mishowo:sync:v1"); } catch { /* sin storage */ }
}
