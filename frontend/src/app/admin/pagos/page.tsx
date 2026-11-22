import type { Metadata } from "next";
import { Payments } from "@/components/admin/AdminPages";

export const metadata: Metadata = { title: "Pagos" };

export default function Page() {
  return <Payments />;
}
