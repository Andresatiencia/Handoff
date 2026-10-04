import { PageLoading } from "@/components/page-loading";
import { Suspense } from "react";
import { BundleDetail } from "@/components/bundle-detail";

export default async function BundlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<PageLoading label="Loading bundle…" />}><BundleDetail id={id} /></Suspense>;
}
