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
import { FlowIntro } from "./flow-intro";

export function SellForm({ editing }: { editing?: Listing }) {
  const params = useSearchParams();
  return <AccountGate next={editing ? `/listings/${editing.id}/edit` : `/sell?${params}`}><ListingForm editing={editing} /></AccountGate>;
}

function ListingForm({ editing }: { editing?: Listing }) {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [price, setPrice] = useState(editing ? Number(editing.price).toFixed(2) : "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(""); setSaving(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (String(fields.availableFrom) > String(fields.availableUntil)) { setError("Availability must end on or after its start date."); setSaving(false); return; }
    try {
      const image = removePhoto ? null : photo ? await preparePhoto(photo) : undefined;
      const result = await api<{ listing: Listing }>(editing ? `listings/${editing.id}` : "listings", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ ...fields, price: Number(fields.price), departure: editing ? undefined : params.get("departure") || undefined, image }),
      });
      router.push(`/listings/${result.listing.id}?${editing ? "updated" : "posted"}=1`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save your item. Please try again.");
      setSaving(false);
    }
  }

  return <main className="page-width task-page py-10 sm:py-14">
    <Link href={editing ? `/listings/${editing.id}` : "/marketplace"} className="nav-link">← Back to {editing ? "listing" : "marketplace"}</Link>
    <div className="flow-layout">
      <FlowIntro title={editing ? "Update your handoff." : "Pass something good along."} description={editing ? "Keep the details accurate so the next student knows exactly what to expect." : "Add your item and when it can be picked up. A price of $0 makes it a free handoff."} image="kitchen"><div className="flow-progress"><span>Your essential</span><span>Its next chapter</span></div></FlowIntro>
      <form onSubmit={submit} className="form-panel space-y-5">
        <h2>{editing ? "Edit your listing" : "Your essential"}</h2>
        <p className="text-sm text-muted">Posting as <strong className="text-forest">{user?.name}</strong></p>
        <UniversitySelect />
        <label className="block text-sm font-semibold">Item title<input name="title" className="form-input mt-2" required maxLength={80} defaultValue={editing?.title} placeholder="e.g. Mini fridge, ready for a new dorm" /></label>
        <label className="block text-sm font-semibold">Description<textarea name="description" className="form-input mt-2 min-h-28" required maxLength={1500} defaultValue={editing?.description} placeholder="Share the details, any wear, and pickup information." /></label>
        <div>
          <label htmlFor="product-photo" className="block text-sm font-semibold">Product photo <span className="font-normal text-muted">(optional)</span></label>
          <input id="product-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const chosen = event.target.files?.[0] ?? null; setPhoto(chosen); setRemovePhoto(false); setPreview(chosen ? URL.createObjectURL(chosen) : ""); }} className="form-input mt-2 file:mr-4 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:font-semibold file:text-forest" />
          <p className="mt-2 text-xs text-muted">JPEG, PNG, or WebP, up to 10 MB. We resize it before saving.</p>
          {preview && <Image unoptimized src={preview} alt="Product photo preview" width={640} height={400} className="mt-4 h-48 w-full rounded-2xl bg-sand object-contain" />}
          {!preview && editing?.hasImage && !removePhoto && <Image unoptimized src={`/api/listings/${editing.id}/image`} alt="Current product photo" width={640} height={400} className="mt-4 h-48 w-full rounded-2xl bg-sand object-contain" />}
          {editing?.hasImage && !photo && <label className="mt-3 flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={removePhoto} onChange={event => setRemovePhoto(event.target.checked)} />Remove current photo</label>}
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="text-sm font-semibold">Category<select name="category" className="form-input mt-2" defaultValue={editing?.category}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
          <label className="text-sm font-semibold">Condition<select name="condition" className="form-input mt-2" defaultValue={editing?.condition}><option>Good</option><option>Like new</option><option>Used</option></select></label>
          <label className="text-sm font-semibold">Price (USD)<input name="price" type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={price} onChange={event => { const next = event.target.value.replace(",", "."); if (/^[0-9]*([.][0-9]{0,2})?$/.test(next)) setPrice(next); }} required className="form-input mt-2" placeholder="0.00" /><span className="mt-1 block text-xs font-normal text-muted">Use up to 2 decimal places.</span></label>
        </div>
        <div className="form-section"><h2>When can it change hands?</h2><div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">Available from<input name="availableFrom" type="date" required min="2020-01-01" max="2100-12-31" defaultValue={editing?.availableFrom} className="form-input mt-2" /></label>
          <label className="text-sm font-semibold">Available until<input name="availableUntil" type="date" required min="2020-01-01" max="2100-12-31" defaultValue={editing?.availableUntil ?? params.get("departure") ?? ""} className="form-input mt-2" /></label>
        </div></div>
        {!editing && params.get("departure") && <p className="text-xs text-muted">Your leaving date: {params.get("departure")}. Choose pickup dates before you leave.</p>}
        <p className="rounded-xl bg-sand p-3 text-xs leading-5 text-muted">Your item will be visible to everyone browsing Handoff. Interested students can message you privately. If you skip a photo, a category illustration appears instead.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={saving} className="button-primary w-full disabled:cursor-wait disabled:opacity-60" type="submit">{saving ? "Saving…" : editing ? "Save changes" : "Post item"}</button>
      </form>
    </div>
  </main>;
}
