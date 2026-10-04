"use client";

import Link from "next/link";
import type { Listing } from "@/lib/listings";
import { UNIVERSITY } from "@/lib/universities";
import { useRemote } from "@/lib/api-client";
import { ListingCard } from "./listing-card";

// Fetched from the client so the landing page stays static and keeps rendering
// on hosts where the database is unavailable.
export function RecentListings() {
  const { data, loading, error, refresh } = useRemote<{ listings: Listing[] }>(
    `listings?available=true&university=${encodeURIComponent(UNIVERSITY)}`,
  );
  if (loading) return <p className="py-6 text-sm text-muted" role="status">Loading the latest items…</p>;
  if (error || !data) return <div role="alert">{error || "Could not load the latest items."} <button type="button" className="underline" onClick={refresh}>Try again</button></div>;
  const listings = data.listings.slice(0, 3);
  if (!listings.length) {
    return <p className="empty-state text-sm text-muted">
      Nothing here yet. <Link href="/sell" className="font-semibold text-forest underline">Post the first item</Link> and start someone else&apos;s next chapter.
    </p>;
  }
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
    {listings.map(listing => <ListingCard key={listing.id} listing={listing} onChange={refresh} />)}
  </div>;
}
