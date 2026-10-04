import { PageLoading } from "@/components/page-loading";
import { Suspense } from "react";
import { SellForm } from "@/components/sell-form";

export default function SellPage() {
  return <Suspense fallback={<PageLoading label="Loading listing form…" />}><SellForm /></Suspense>;
}
