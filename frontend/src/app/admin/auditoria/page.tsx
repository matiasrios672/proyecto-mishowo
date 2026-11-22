import type { Metadata } from "next";
import { Audit } from "@/components/admin/AdminPages";

export const metadata: Metadata = { title: "Auditoría" };

export default function Page() {
  return <Audit />;
}
