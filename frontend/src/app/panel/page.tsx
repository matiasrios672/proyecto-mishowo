import { redirect } from "next/navigation";

// /panel es la entrada al panel: lleva a Pedidos, lo que más se mira.
export default function PanelHome() {
  redirect("/panel/pedidos");
}
