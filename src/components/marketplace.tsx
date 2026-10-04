"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { categories, type Category, type Listing } from "@/lib/listings";
import { UNIVERSITY } from "@/lib/universities";
import { useRemote } from "@/lib/api-client";
import { CategorySelector } from "./category-selector";
import { ListingCard } from "./listing-card";
import { useAuth } from "./auth-provider";

export function Marketplace() {
  const params = useSearchParams();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Category[]>((params.get("categories") ?? "").split(",").filter((item): item is Category => categories.includes(item as Category)));
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [matchArrival, setMatchArrival] = useState(true);
  const mine = params.get("mine") === "true";
  const arrival = params.get("arrival");
  const filters = new URLSearchParams({ university: UNIVERSITY });
  if (selected.length) filters.set("categories", selected.join(","));
  if (search.trim()) filters.set("q", search.trim());
  if (availableOnly) filters.set("available", "true");
  if (arrival && matchArrival) filters.set("arrival", arrival);
  if (mine) filters.set("mine", "true");
  const { data, loading, error, refresh } = useRemote<{ listings: Listing[] }>(`listings?${filters}`, 10000);
  const visible = data?.listings ?? [];
  const posted = visible.find(item => item.id === Number(params.get("posted")));

  return <main className="page-width py-12 sm:py-16">
    <p className="label">University of Central Missouri</p>
    <h1 className="display-xl mt-4 max-w-[13ch]">{mine ? "Your items, their next chapter." : "Good things, ready to go."}</h1>
    <p className="lede mt-6">Everyday essentials with another chapter in them. Find your next home comfort and message the student passing it on.</p>
    <div className="mt-8 flex flex-wrap gap-3">
      <Link href="/sell" className="button-primary">Post an item</Link>
      <Link href="/arriving" className="button-secondary">Set arrival details</Link>
    </div>

    <div className="mt-8 flex gap-6 text-sm">
      <Link href="/marketplace" className={mine ? "nav-link" : "font-medium text-forest"}>All items</Link>
      {user && <Link href="/marketplace?mine=true" className={mine ? "font-medium text-forest" : "nav-link"}>My listings</Link>}
    </div>

    {posted && <p role="status" className="mt-6 rounded-xl bg-sand px-5 py-4 text-sm">Your listing &ldquo;{posted.title}&rdquo; is live. Other students can now see it and message you.</p>}
    {arrival && <div className="mt-6 rounded-xl bg-sand px-5 py-4 text-sm">
      <p className="font-medium">Arriving {arrival} at {UNIVERSITY}</p>
      <label className="mt-3 flex items-center gap-2 text-muted"><input type="checkbox" checked={matchArrival} onChange={event => setMatchArrival(event.target.checked)} className="accent-forest" />Only show items available on my arrival date</label>
    </div>}

    <div className="rule mt-10 pt-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <label className="block w-full text-sm sm:max-w-sm">
          <span className="label">Find an essential</span>
          <input type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="A fridge, a coat, a lamp…" className="form-input mt-2" />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="h-4 w-4 accent-forest" checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)} />Available only
        </label>
      </div>
      <div className="mt-6"><CategorySelector selected={selected} onChange={setSelected} /></div>
    </div>

    {error && <div role="alert" className="mt-6 rounded-xl bg-white px-5 py-4 text-sm text-red-700">{error} <button onClick={refresh} className="underline">Try again</button>{mine && !user && <Link href="/account?next=%2Fmarketplace%3Fmine%3Dtrue" className="ml-3 underline">Sign in</Link>}</div>}

    <p aria-live="polite" className="label my-8">{loading ? "Loading items…" : `${visible.length} ${visible.length === 1 ? "listing" : "listings"}`}</p>

    {visible.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((listing, i) => <div key={listing.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
        <ListingCard listing={listing} onChange={refresh} />
      </div>)}
    </div> : !loading && !error && <div className="rule py-16 text-center">
      <h2 className="display-lg">No items here yet.</h2>
      <p className="lede mx-auto mt-4">Try different filters, or be the first to pass something on.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button className="button-secondary" onClick={() => { setSelected([]); setQuery(""); setAvailableOnly(false); setMatchArrival(false); }}>Clear filters</button>
        <Link href="/sell" className="button-primary">Post an item</Link>
      </div>
    </div>}
  </main>;
}
