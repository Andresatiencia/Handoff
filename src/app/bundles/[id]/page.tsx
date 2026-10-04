import { Suspense } from "react";
import { BundleDetail } from "@/components/bundle-detail";

export default async function BundlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<main className="page-width py-16">Loading bundle…</main>}><BundleDetail id={id} /></Suspense>;
}
