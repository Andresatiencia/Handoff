import { Suspense } from "react";
import { ListingDetail } from "@/components/listing-detail";
import { PageLoading } from "@/components/page-loading";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<PageLoading label="Loading listing…" />}><ListingDetail id={Number(id)} /></Suspense>;
}
