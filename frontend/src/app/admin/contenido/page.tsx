import type { Metadata } from "next";
import { Content } from "@/components/admin/AdminOps";

export const metadata: Metadata = { title: "Contenido" };

export default function Page() {
  return <Content />;
}
