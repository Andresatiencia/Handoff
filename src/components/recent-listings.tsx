"use client";

import Link from "next/link";
import { formatDate, type Listing } from "@/lib/listings";
import { UNIVERSITY } from "@/lib/universities";
import { useRemote } from "@/lib/api-client";
import { ItemArt } from "./item-art";

// Fetched from the client so the landing page stays static and keeps rendering
// on hosts where the database is unavailable.
export function RecentListings() {
  const { data, loading, error } = useRemote<{ listings: Listing[] }>(
    `listings?available=true&university=${encodeURIComponent(UNIVERSITY)}`,
  );
  if (loading) return <p className="label py-8" role="status">Loading the latest items…</p>;
  if (error || !data) return null;
  const listings = data.listings.slice(0, 4);
  if (!listings.length) {
    return <p className="py-8 text-sm text-muted">
      Nothing here yet.{" "}
      <Link href="/sell" className="font-medium text-forest underline underline-offset-4">Post the first item</Link>{" "}
      and start someone else&apos;s next chapter.
    </p>;
  }
  return <ul>
    {listings.map((listing, i) => <li key={listing.id} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
      <ListingRow listing={listing} />
    </li>)}
  </ul>;
}

function ListingRow({ listing }: { listing: Listing }) {
  return <Link
    href="/marketplace"
    className="rule group grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 py-5 sm:grid-cols-[4.5rem_1fr_auto] sm:gap-6"
  >
    <span
      className="flex aspect-square items-center justify-center overflow-hidden rounded-xl"
      style={{ backgroundColor: listing.color }}
    >
      <ItemArt kind={listing.illustration} className="h-full w-full scale-[1.35]" />
    </span>
    <span className="min-w-0">
      {/* Wrap rather than truncate: a clipped title tells the reader nothing. */}
      <span className="display-sm sm:display-md line-clamp-2 block">{listing.title}</span>
      <span className="label mt-1 block">
        {listing.category}
        {/* The date range needs room; on a phone the marketplace carries it instead. */}
        <span className="hidden sm:inline">
          <span className="mx-2 text-ink/20">/</span>
          {formatDate(listing.availableFrom)} – {formatDate(listing.availableUntil)}
        </span>
      </span>
    </span>
    <span className="display-md tabular-nums text-forest">
      {listing.price === 0 ? "Free" : `$${listing.price}`}
    </span>
  </Link>;
}
