"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { categories, type Listing } from "@/lib/listings";
import { api } from "@/lib/api-client";
import { useAuth, AccountGate } from "./auth-provider";
import { UniversitySelect } from "./university-select";
import { preparePhoto } from "@/lib/photo";

export function SellForm() {
  const params = useSearchParams();
  return <AccountGate next={`/sell?${params}`}><ListingForm /></AccountGate>;
}

function ListingForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(""); setSaving(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const image = photo ? await preparePhoto(photo) : undefined;
      const result = await api<{ listing: Listing }>("listings", {
        method: "POST",
        body: JSON.stringify({ ...fields, price: Number(fields.price), departure: params.get("departure") || undefined, image }),
      });
      router.push(`/marketplace?posted=${result.listing.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not post your item. Please try again.");
      setSaving(false);
    }
  }

  return <main className="page-width py-10 sm:py-14">
    <Link href="/marketplace" className="nav-link">← Back to marketplace</Link>
    <div className="mx-auto mt-8 max-w-2xl">
      
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Pass something good along.</h1>
      <p className="mt-4 leading-7 text-muted">Add your item and when it can be picked up. A price of $0 makes it a free handoff.</p>
      <form onSubmit={submit} className="mt-8 space-y-5 rounded-3xl border border-ink/10 bg-white p-6 sm:p-8">
        <p className="text-sm text-muted">Posting as <strong className="text-forest">{user?.name}</strong></p>
        <UniversitySelect />
        <label className="block text-sm font-semibold">Item title<input name="title" className="form-input mt-2" required maxLength={80} placeholder="e.g. Mini fridge, ready for a new dorm" /></label>
        <label className="block text-sm font-semibold">Description<textarea name="description" className="form-input mt-2 min-h-28" required maxLength={1500} placeholder="Share the details, any wear, and pickup information." /></label>
        <div>
          <label htmlFor="product-photo" className="block text-sm font-semibold">Product photo <span className="font-normal text-muted">(optional)</span></label>
          <input id="product-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const chosen = event.target.files?.[0] ?? null; setPhoto(chosen); setPreview(chosen ? URL.createObjectURL(chosen) : ""); }} className="form-input mt-2 file:mr-4 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:font-semibold file:text-forest" />
          <p className="mt-2 text-xs text-muted">JPEG, PNG, or WebP, up to 10 MB. We resize it before posting.</p>
          {preview && <Image unoptimized src={preview} alt="Product photo preview" width={640} height={400} className="mt-4 h-48 w-full rounded-2xl object-cover" />}
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="text-sm font-semibold">Category<select name="category" className="form-input mt-2">{categories.map(category => <option key={category}>{category}</option>)}</select></label>
          <label className="text-sm font-semibold">Condition<select name="condition" className="form-input mt-2"><option>Good</option><option>Like new</option><option>Used</option></select></label>
          <label className="text-sm font-semibold">Price (USD)<input name="price" type="number" min="0" max="100000" step="0.01" required className="form-input mt-2" placeholder="0.00" /></label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">Available from<input name="availableFrom" type="date" required min="2020-01-01" max="2100-12-31" className="form-input mt-2" /></label>
          <label className="text-sm font-semibold">Available until<input name="availableUntil" type="date" required min="2020-01-01" max="2100-12-31" defaultValue={params.get("departure") ?? ""} className="form-input mt-2" /></label>
        </div>
        {params.get("departure") && <p className="text-xs text-muted">Your leaving date: {params.get("departure")}. Choose pickup dates before you leave.</p>}
        <p className="rounded-xl bg-sand p-3 text-xs leading-5 text-muted">Your item will be visible to everyone browsing Handoff. Interested students can message you privately. If you skip a photo, a category illustration appears instead.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={saving} className="button-primary w-full disabled:cursor-wait disabled:opacity-60" type="submit">{saving ? "Posting…" : "Post item"}</button>
      </form>
    </div>
  </main>;
}
