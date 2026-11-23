import type { Metadata } from "next";
import { Industries } from "@/components/admin/AdminIndustries";

export const metadata: Metadata = { title: "Rubros" };

export default function Page() {
  return <Industries />;
}
