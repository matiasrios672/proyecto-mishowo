import type { Metadata } from "next";
import { Plans } from "@/components/admin/AdminPages";

export const metadata: Metadata = { title: "Planes" };

export default function Page() {
  return <Plans />;
}
