import type { Metadata } from "next";
import { Leads } from "@/components/admin/AdminLeads";

export const metadata: Metadata = { title: "Leads" };

export default function Page() {
  return <Leads />;
}
