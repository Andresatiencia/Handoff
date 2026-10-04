"use client";

import Link from "next/link";
import { useRemote } from "@/lib/api-client";
import type { Listing } from "@/lib/listings";
import { AccountGate, useAuth } from "./auth-provider";
import { SellForm } from "./sell-form";

export function EditListing({ id }: { id: number }) {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useRemote<{ listing: Listing }>(`listings/${id}`);
  return <AccountGate next={`/listings/${id}/edit`}>
    {loading && <main className="page-width py-16"><p role="status">Loading listing…</p></main>}
    {error && <main className="page-width py-16"><p role="alert">{error}</p><button onClick={refresh} className="text-link mt-3">Try again</button></main>}
    {data?.listing && (data.listing.sellerId === user?.id
      ? <SellForm editing={data.listing} />
      : <main className="page-width py-16"><h1 className="text-2xl font-semibold">Only the seller can edit this listing.</h1><Link href={`/listings/${id}`} className="text-link mt-5">View listing</Link></main>)}
  </AccountGate>;
}
