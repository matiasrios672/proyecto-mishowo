import type { Metadata } from "next";
import { Businesses } from "@/components/admin/AdminPages";

export const metadata: Metadata = { title: "Negocios" };

export default function Page() {
  return <Businesses />;
}
