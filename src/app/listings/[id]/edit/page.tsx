import { Suspense } from "react";
import { EditListing } from "@/components/edit-listing";
import { PageLoading } from "@/components/page-loading";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<PageLoading label="Loading editor…" />}><EditListing id={Number(id)} /></Suspense>;
}
