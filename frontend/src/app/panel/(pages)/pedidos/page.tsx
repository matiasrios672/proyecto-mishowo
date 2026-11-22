import type { Metadata } from "next";
import { OrdersPanel } from "@/components/panel/OrdersPanel";

export const metadata: Metadata = { title: "Pedidos" };

export default function PedidosPage() {
  return <OrdersPanel />;
}
