import type { Metadata } from "next";
import { ReviewsPanel } from "@/components/panel/ReviewsPanel";

export const metadata: Metadata = { title: "Reseñas" };

export default function Page() {
  return <ReviewsPanel />;
}
