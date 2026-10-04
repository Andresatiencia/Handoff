"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, useRemote } from "@/lib/api-client";
import { bundleItemName, bundleMatch, bundleSavings, bundleTiming, moveInNeeds, type Bundle } from "@/lib/bundles";
import { formatDate, formatPrice } from "@/lib/listings";
import { useAuth } from "./auth-provider";

export function BundleDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const { user } = useAuth();
  const { data, loading, error, refresh } = useRemote<{ bundle: Bundle }>(`bundles/${encodeURIComponent(id)}`, 10000);
  const [claimed, setClaimed] = useState<Bundle | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const bundle = claimed ?? data?.bundle;
  const backParams = new URLSearchParams();
  for (const key of ["arrival", "categories", "needs"]) if (params.get(key)) backParams.set(key, params.get(key)!);
  const back = `/marketplace${backParams.size ? `?${backParams}` : ""}`;
  const detailUrl = `/bundles/${encodeURIComponent(id)}${backParams.size ? `?${backParams}` : ""}`;

  async function claim() {
    if (claiming) return;
    setClaimError(""); setClaiming(true);
    try {
      const result = await api<{ bundle: Bundle }>(`bundles/${encodeURIComponent(id)}/claim`, { method: "POST" });
      setClaimed(result.bundle);
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Could not reserve this bundle.");
      refresh();
    } finally { setClaiming(false); }
  }

  return <main className="page-width py-10 sm:py-14">
    <Link href={back} className="nav-link">← Back to marketplace</Link>
    {loading && <p role="status" className="mt-10">Loading bundle…</p>}
    {error && <p role="alert" className="mt-10 rounded-xl bg-white p-5 text-red-700">{error} <button onClick={refresh} className="underline">Try again</button></p>}
    {bundle && (() => {
      const match = bundleMatch(bundle, moveInNeeds(params.get("needs"), params.get("categories")));
      const timing = bundleTiming(bundle, params.get("arrival"));
      const savings = bundleSavings(bundle);
      return <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="rounded-3xl bg-[#e7ede0] p-7 sm:p-10"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-forest">Move-in kit · {bundle.items.length} items</span><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-forest">{bundle.status === "reserved" ? "Reserved" : "Available"}</span>{bundle.demo && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-muted">Demo bundle</span>}</div><h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">{bundle.name}</h1><p className="mt-4 max-w-2xl leading-7 text-muted">{bundle.description}</p><p className="mt-5 text-sm">Passed on by <strong>{bundle.sellerName}</strong> · {bundle.university}</p></div>
          <div className="mt-7 rounded-3xl border border-ink/10 bg-white p-6 sm:p-8"><h2 className="text-2xl font-semibold">Everything included</h2><p className="mt-2 text-sm text-muted">One reservation covers every item below.</p><ul className="mt-6 grid gap-3 sm:grid-cols-2">{bundle.items.map((item, index) => <li key={`${item.name}-${index}`} className="rounded-xl border border-ink/10 bg-cream p-4"><p className="font-semibold text-forest">✓ {bundleItemName(item)}</p><p className="mt-1 text-xs text-muted">{item.category} · Condition: {item.condition}</p></li>)}</ul></div>
        </div>
        <aside className="h-fit rounded-3xl border border-forest/20 bg-white p-6 shadow-sm lg:sticky lg:top-6">
          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-sand p-3"><p className="text-3xl font-bold text-forest">{match.percent === null ? "—" : `${match.percent}%`}</p><p className="text-xs font-semibold">Needs match</p></div><div className="rounded-xl bg-[#f9f2e3] p-3"><p className="text-sm font-bold text-amber">{timing.label}</p><p className="mt-1 text-xs text-muted">Timing match</p></div></div>
          <p className="mt-4 text-sm text-muted">{match.total ? `Matches ${match.matched} of your ${match.total} needs` : <Link href="/arriving" className="text-forest underline">Set your needs to see a match</Link>}</p>
          <div className="mt-6 border-t border-ink/10 pt-5"><p className="text-xs text-muted">Bundle price</p><p className="text-4xl font-bold">{formatPrice(bundle.priceCents / 100)}</p><p className="mt-3 text-sm text-muted">Estimated new cost: {formatPrice(bundle.retailCents / 100)}</p><p className="mt-2 text-xl font-bold text-forest">You save {formatPrice(savings / 100)}</p></div>
          <p className="mt-6 border-t border-ink/10 pt-5 text-sm">Available {formatDate(bundle.availableFrom)} – {formatDate(bundle.availableUntil)}</p>
          {bundle.claimedByMe ? <div role="status" className="mt-6 rounded-xl bg-sand p-5"><p className="text-xl font-bold text-forest">Handoff reserved!</p><p className="mt-2 text-sm">You just reserved {bundle.items.length} move-in essentials for {formatPrice(bundle.priceCents / 100)}.</p><p className="mt-2 text-sm">You saved approximately {formatPrice(savings / 100)} compared with buying them new.</p>{bundle.demo && <p className="mt-3 text-xs text-muted">This is a demo bundle; no real pickup is arranged.</p>}</div>
            : bundle.status === "reserved" ? <p className="mt-6 rounded-xl bg-[#fff1d5] p-4 text-sm font-semibold">This bundle has already been reserved.</p>
            : bundle.sellerId === user?.id ? <p className="mt-6 rounded-xl bg-sand p-4 text-sm">This is your bundle.</p>
            : user?.emailVerificationRequired ? <Link href="/account" className="button-primary mt-6 w-full">Verify email to claim</Link>
            : user ? <button type="button" onClick={claim} disabled={claiming} className="button-primary mt-6 w-full disabled:opacity-60">{claiming ? "Reserving…" : "Claim Bundle"}</button>
            : <Link href={`/account?next=${encodeURIComponent(detailUrl)}`} className="button-primary mt-6 w-full">Sign in to claim</Link>}
          {claimError && <p role="alert" className="mt-3 text-sm text-red-700">{claimError}</p>}
          <p className="mt-4 text-xs leading-5 text-muted">No payment is collected. Reserving holds the whole bundle.</p>
        </aside>
      </div>;
    })()}
  </main>;
}
