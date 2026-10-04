import { Suspense } from "react";
import { SellForm } from "@/components/sell-form";

export default function SellPage() {
  return <Suspense fallback={<main className="page-width py-16">Loading listing form…</main>}><SellForm /></Suspense>;
}
