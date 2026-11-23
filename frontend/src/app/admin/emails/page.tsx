import type { Metadata } from "next";
import { Emails } from "@/components/admin/AdminMail";

export const metadata: Metadata = { title: "Emails" };

export default function Page() {
  return <Emails />;
}
