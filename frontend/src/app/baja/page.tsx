import type { Metadata } from "next";
import { Suspense } from "react";
import { Unsubscribe } from "@/components/marketing/Unsubscribe";

export const metadata: Metadata = { title: "Darte de baja de las novedades", robots: { index: false } };

export default function Page() {
  return <Suspense fallback={null}><Unsubscribe /></Suspense>;
}
