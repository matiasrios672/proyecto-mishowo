import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrandScope } from "@/components/brand/BrandScope";
import { PanelRoot } from "@/components/panel/PanelRoot";

export const metadata: Metadata = { title: { default: "Mi panel", template: "%s · Mi panel" }, robots: { index: false, follow: false } };

export default function PanelRootLayout({ children }: { children: ReactNode }) {
  return <BrandScope><PanelRoot>{children}</PanelRoot></BrandScope>;
}
