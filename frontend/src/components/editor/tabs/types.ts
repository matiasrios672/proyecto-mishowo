import type { Draft } from "@/lib/draft";
import type { EditorTab } from "@/lib/score";

export interface TabProps {
  draft: Draft;
  /** `key` agrupa cambios seguidos del mismo campo en un único paso de "deshacer". */
  update: (fn: (d: Draft) => Draft, key?: string | null) => void;
  goTab: (t: EditorTab) => void;
}
