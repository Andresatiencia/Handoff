import { PageLoading } from "@/components/page-loading";
import { Suspense } from "react";
import { Marketplace } from "@/components/marketplace";
export default function MarketplacePage() { return <Suspense fallback={<PageLoading label="Loading items…" />}><Marketplace /></Suspense>; }
