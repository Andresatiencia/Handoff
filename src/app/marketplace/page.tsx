import { Suspense } from "react";
import { Marketplace } from "@/components/marketplace";
export default function MarketplacePage() { return <Suspense fallback={<main className="page-width py-16">Loading example listings…</main>}><Marketplace /></Suspense>; }
