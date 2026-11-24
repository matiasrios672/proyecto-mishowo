import type { Metadata } from "next";
import { BusinessDetail } from "@/components/admin/AdminBusiness";

export const metadata: Metadata = { title: "Negocio" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <BusinessDetail id={(await params).id} />;
}
