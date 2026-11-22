import { redirect } from "next/navigation";

// /panel es la entrada al panel: lleva al Inicio.
export default function PanelHome() {
  redirect("/panel/inicio");
}
