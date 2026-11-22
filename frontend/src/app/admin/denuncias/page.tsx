import type { Metadata } from "next";
import { Reports } from "@/components/admin/AdminOps";

export const metadata: Metadata = { title: "Denuncias" };

export default function Page() {
  return <Reports />;
}
