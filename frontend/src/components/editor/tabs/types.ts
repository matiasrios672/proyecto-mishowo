import type { Draft } from "@/lib/draft";
import type { EditorTab } from "@/lib/score";

export interface TabProps {
  draft: Draft;
  /** `key` agrupa cambios seguidos del mismo campo en un único paso de "deshacer". */
  update: (fn: (d: Draft) => Draft, key?: string | null) => void;
  goTab: (t: EditorTab) => void;
  /** Hay sesión y el borrador se está sincronizando con la cuenta. `settle` espera a que lo pendiente llegue al servidor. */
  account?: { enabled: boolean; settle: () => Promise<void> };
}
