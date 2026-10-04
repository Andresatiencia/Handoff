"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRemote } from "@/lib/api-client";
import { formatDate, formatPrice, type Listing } from "@/lib/listings";
import { useAuth } from "./auth-provider";
import { ListingActions } from "./listing-actions";

export function ListingDetail({ id }: { id: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const { data, loading, error, refresh } = useRemote<{ listing: Listing }>(`listings/${id}`, 10000);
  const listing = data?.listing;

  return <main className="page-width task-page py-10 sm:py-14">
    <Link href="/marketplace" className="nav-link">← Back to marketplace</Link>
    {loading && <p role="status" className="mt-8 text-muted">Loading listing…</p>}
    {error && <div role="alert" className="mt-8 rounded-2xl bg-white p-6"><p>{error}</p><button onClick={refresh} className="text-link mt-3">Try again</button></div>}
    {listing && <>
      {(params.has("posted") || params.has("updated")) && <p role="status" className="mt-6 rounded-xl bg-sand p-4 text-sm">{params.has("posted") ? "Your listing is live." : "Your changes are saved."} Students can see these details now.</p>}
      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <div className="overflow-hidden rounded-3xl border border-ink/10 bg-sand">
          {listing.hasImage ? <Image unoptimized src={`/api/listings/${listing.id}/image`} alt={listing.title} width={960} height={720} className="h-[22rem] w-full object-contain sm:h-[32rem]" />
            : <div className="flex h-[22rem] flex-col items-center justify-center gap-3 p-8 text-center sm:h-[32rem]"><span className="text-sm font-bold text-forest">Handoff</span><strong className="font-serif text-4xl">{listing.category}</strong><span className="text-sm text-muted">Photo not added</span></div>}
        </div>
        <div className="h-fit rounded-3xl border border-ink/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-sand px-3 py-1 text-forest">{listing.category}</span><span className="rounded-full bg-sand px-3 py-1 text-forest">{listing.status === "available" ? "Available" : listing.status === "reserved" ? "Reserved" : "Sold"}</span></div>
          <h1 className="mt-5 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{listing.title}</h1>
          <p className="mt-3 text-3xl font-bold text-forest">{formatPrice(listing.price)}</p>
          <p className="mt-5 text-sm text-muted">Passed on by <strong className="text-ink">{listing.sellerName}</strong> · {listing.university}</p>
          <dl className="mt-6 grid gap-4 border-y border-ink/10 py-5 text-sm sm:grid-cols-2"><div><dt className="text-muted">Condition</dt><dd className="mt-1 font-semibold">{listing.condition}</dd></div><div><dt className="text-muted">Pickup window</dt><dd className="mt-1 font-semibold">{formatDate(listing.availableFrom)} – {formatDate(listing.availableUntil)}</dd></div></dl>
          <h2 className="mt-6 text-lg font-semibold">About this item</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted">{listing.description}</p>
          {user?.id === listing.sellerId && <Link href={`/listings/${listing.id}/edit`} className="button-primary mt-6 w-full">Edit listing</Link>}
          <ListingActions listing={listing} onChange={refresh} onDelete={() => router.push("/marketplace?mine=true")} />
        </div>
      </div>
    </>}
  </main>;
}
