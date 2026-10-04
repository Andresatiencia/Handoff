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
  const [minimumPrice, setMinimumPrice] = useState(params.get("minPrice") ?? "");
  const [maximumPrice, setMaximumPrice] = useState(params.get("maxPrice") ?? "");
  const [appliedMinimum, setAppliedMinimum] = useState(params.get("minPrice") ?? "");
  const [appliedMaximum, setAppliedMaximum] = useState(params.get("maxPrice") ?? "");
  const [priceError, setPriceError] = useState("");
  const mine = params.get("mine") === "true";
  const arrival = params.get("arrival");
  const filters = new URLSearchParams({ university: UNIVERSITY });
  if (selected.length) filters.set("categories", selected.join(","));
  if (search.trim()) filters.set("q", search.trim());
  if (availableOnly) filters.set("available", "true");
  if (arrival && matchArrival) filters.set("arrival", arrival);
  if (appliedMinimum) filters.set("minPrice", appliedMinimum);
  if (appliedMaximum) filters.set("maxPrice", appliedMaximum);
  if (mine) filters.set("mine", "true");
  const { data, loading, error, refresh } = useRemote<{ listings: Listing[] }>(`listings?${filters}`, 10000);
  const visible = data?.listings ?? [];
  const posted = visible.find(item => item.id === Number(params.get("posted")));

  function updatePriceUrl(minimum: string, maximum: string) {
    const next = new URLSearchParams(params.toString());
    if (minimum) next.set("minPrice", minimum); else next.delete("minPrice");
    if (maximum) next.set("maxPrice", maximum); else next.delete("maxPrice");
    const query = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }

  function applyPrice() {
    const minimum = minimumPrice.replace(/[.]$/, "");
    const maximum = maximumPrice.replace(/[.]$/, "");
    if ((minimum && Number(minimum) > 100000) || (maximum && Number(maximum) > 100000)) {
      setPriceError("Prices must be $100,000 or less."); return;
    }
    if (minimum && maximum && Number(minimum) > Number(maximum)) {
      setPriceError("Minimum price cannot exceed maximum price."); return;
    }
    setPriceError("");
    setMinimumPrice(minimum); setMaximumPrice(maximum);
    setAppliedMinimum(minimum); setAppliedMaximum(maximum);
    updatePriceUrl(minimum, maximum);
  }

  function clearPrice() {
    setPriceError("");
    setMinimumPrice(""); setMaximumPrice("");
    setAppliedMinimum(""); setAppliedMaximum("");
    updatePriceUrl("", "");
  }

  return <main className="page-width py-10 sm:py-14">
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="eyebrow">University of Central Missouri</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{mine ? "Your items, their next chapter." : "Good things, ready to go."}</h1><p className="mt-4 max-w-xl text-sm leading-7 text-muted">Everyday essentials with another chapter in them. Find your next home comfort and message the student passing it on.</p></div>
      <div className="flex flex-wrap gap-3"><Link href="/arriving" className="button-secondary">Set arrival details</Link><Link href="/sell" className="button-primary">Post an item +</Link></div>
    </div>
    <div className="mt-5 flex gap-5 text-sm font-semibold text-forest"><Link href="/marketplace">All items</Link>{user && <Link href="/marketplace?mine=true">My listings</Link>}</div>
    {posted && <p role="status" className="mt-6 rounded-xl bg-sand p-4 text-sm">Your listing “{posted.title}” is live. Other students can now see it and message you.</p>}
    {arrival && <div className="mt-6 rounded-xl border border-forest/15 bg-sand p-4 text-sm"><p className="font-semibold">Arriving {arrival} at {UNIVERSITY}</p><label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={matchArrival} onChange={event => setMatchArrival(event.target.checked)} className="accent-forest" />Only show items available on my arrival date</label></div>}
    <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-5 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="block w-full text-sm font-semibold sm:max-w-md">Find an essential<input type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search for a fridge, coat, lamp…" className="form-input mt-2" /></label>
        <label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm text-muted"><input type="checkbox" className="h-4 w-4 accent-forest" checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)} />Available items only</label>
      </div><CategorySelector selected={selected} onChange={setSelected} />
      <div className="mt-6 border-t border-ink/10 pt-5">
        <p className="text-sm font-semibold">Price range <span className="font-normal text-muted">(optional)</span></p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-32 flex-1 text-xs font-semibold text-muted sm:max-w-40">Minimum ($)<input type="text" inputMode="decimal" value={minimumPrice} onChange={event => { const next = event.target.value.replace(",", "."); if (/^[0-9]*([.][0-9]{0,2})?$/.test(next)) { setMinimumPrice(next); setPriceError(""); } }} placeholder="0.00" className="form-input mt-2" /></label>
          <label className="min-w-32 flex-1 text-xs font-semibold text-muted sm:max-w-40">Maximum ($)<input type="text" inputMode="decimal" value={maximumPrice} onChange={event => { const next = event.target.value.replace(",", "."); if (/^[0-9]*([.][0-9]{0,2})?$/.test(next)) { setMaximumPrice(next); setPriceError(""); } }} placeholder="100.00" className="form-input mt-2" /></label>
          <button type="button" onClick={applyPrice} className="button-primary">Apply price</button>
          <button type="button" onClick={clearPrice} className="text-sm font-semibold text-forest underline-offset-2 hover:underline">Clear price</button>
        </div>
        {priceError && <p role="alert" className="mt-2 text-xs text-red-700">{priceError}</p>}
      </div>
    </div>
    {error && <div role="alert" className="mt-6 rounded-xl bg-white p-4 text-sm text-red-700">{error} <button onClick={refresh} className="underline">Try again</button>{mine && !user && <Link href="/account?next=%2Fmarketplace%3Fmine%3Dtrue" className="ml-3 underline">Sign in</Link>}</div>}
    <div className="my-6 flex justify-between text-xs text-muted"><p aria-live="polite">{loading ? "Loading items…" : `${visible.length} listings`}</p><p>Prices in USD</p></div>
    {visible.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map(listing => <ListingCard listing={listing} key={listing.id} onChange={refresh} />)}</div> : !loading && !error && <div className="rounded-2xl border border-dashed border-forest/25 p-12 text-center"><h2 className="text-xl font-semibold">No items here yet.</h2><p className="mt-3 text-sm text-muted">Try different filters, or be the first to pass something on.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button className="button-secondary" onClick={() => { setSelected([]); setQuery(""); setAvailableOnly(false); setMatchArrival(false); clearPrice(); }}>Clear filters</button><Link href="/sell" className="button-primary">Post an item</Link></div></div>}
  </main>;
}
