"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { categories } from "@/lib/listings";
import { UNIVERSITY } from "@/lib/universities";
import type { Bundle, BundleItem } from "@/lib/bundles";
import { AccountGate, useAuth } from "./auth-provider";
import { UniversitySelect } from "./university-select";

const blank = (): BundleItem => ({ name: "", quantity: 1, category: "Kitchen", condition: "Good" });

export function BundleForm() {
  return <AccountGate next="/bundles/new"><CreateBundle /></AccountGate>;
}

function CreateBundle() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<BundleItem[]>([blank(), blank()]);
  const [price, setPrice] = useState("");
  const [retail, setRetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(index: number, changes: Partial<BundleItem>) {
    setItems(current => current.map((item, position) => position === index ? { ...item, ...changes } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (fields.availableFrom > fields.availableUntil) { setError("Availability must end on or after its start date."); return; }
    setError(""); setSaving(true);
    try {
      const result = await api<{ bundle: Bundle }>("bundles", { method: "POST", body: JSON.stringify({
        name: fields.name, description: fields.description, university: fields.university || UNIVERSITY,
        availableFrom: fields.availableFrom, availableUntil: fields.availableUntil,
        price: Number(price), estimatedRetail: Number(retail), items,
      }) });
      router.push(`/bundles/${result.bundle.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not post your bundle.");
      setSaving(false);
    }
  }

  return <main className="page-width py-10 sm:py-14"><Link href="/marketplace" className="nav-link">← Back to marketplace</Link><div className="mx-auto mt-8 max-w-3xl"><p className="eyebrow">For departing students</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Pass a whole move-in kit along.</h1><p className="mt-4 leading-7 text-muted">Group related essentials into one reservation. Be specific about what is included and when the entire kit is ready.</p>
    <form onSubmit={submit} className="mt-8 space-y-6 rounded-3xl border border-ink/10 bg-white p-6 sm:p-8"><p className="text-sm text-muted">Posting as <strong className="text-forest">{user?.name}</strong></p><UniversitySelect />
      <label className="block text-sm font-semibold">Bundle name<input name="name" required maxLength={80} className="form-input mt-2" placeholder="Kitchen Starter Bundle" /></label>
      <label className="block text-sm font-semibold">What makes this kit useful?<textarea name="description" required maxLength={500} className="form-input mt-2 min-h-24" placeholder="Everything an arriving student needs to cook their first meals." /></label>
      <div><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Included items</h2><span className="text-xs text-muted">2–12 items</span></div><div className="mt-4 space-y-4">{items.map((item, index) => <div key={index} className="rounded-2xl border border-ink/10 bg-cream p-4"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">Item {index + 1}</p>{items.length > 2 && <button type="button" onClick={() => setItems(current => current.filter((_, position) => position !== index))} className="text-xs font-semibold text-red-700 hover:underline">Remove</button>}</div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Name<input required maxLength={80} className="form-input mt-2" value={item.name} onChange={event => update(index, { name: event.target.value })} placeholder="Plates" /></label><label className="text-xs font-semibold">Quantity<input type="number" required min={1} max={99} className="form-input mt-2" value={item.quantity} onChange={event => update(index, { quantity: Number(event.target.value) })} /></label><label className="text-xs font-semibold">Category<select className="form-input mt-2" value={item.category} onChange={event => update(index, { category: event.target.value as BundleItem["category"] })}>{categories.map(category => <option key={category}>{category}</option>)}</select></label><label className="text-xs font-semibold">Condition<select className="form-input mt-2" value={item.condition} onChange={event => update(index, { condition: event.target.value as BundleItem["condition"] })}>{["Like new", "Good", "Fair", "Used"].map(condition => <option key={condition}>{condition}</option>)}</select></label></div></div>)}</div>{items.length < 12 && <button type="button" onClick={() => setItems(current => [...current, blank()])} className="button-secondary mt-4">Add another item +</button>}</div>
      <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Bundle price (USD)<input required type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" className="form-input mt-2" value={price} onChange={event => { const next = event.target.value.replace(",", "."); if (/^[0-9]*([.][0-9]{0,2})?$/.test(next)) setPrice(next); }} placeholder="35.00" /></label><label className="text-sm font-semibold">Estimated new cost (USD)<input required type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" className="form-input mt-2" value={retail} onChange={event => { const next = event.target.value.replace(",", "."); if (/^[0-9]*([.][0-9]{0,2})?$/.test(next)) setRetail(next); }} placeholder="120.00" /></label></div>
      <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold">Available from<input name="availableFrom" type="date" required min="2020-01-01" max="2100-12-31" className="form-input mt-2" /></label><label className="text-sm font-semibold">Available until<input name="availableUntil" type="date" required min="2020-01-01" max="2100-12-31" className="form-input mt-2" /></label></div>
      <p className="rounded-xl bg-sand p-3 text-xs leading-5 text-muted">All items in this bundle are reserved together. The estimated new cost is your estimate and is shown to buyers as such.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={saving} className="button-primary w-full disabled:opacity-60">{saving ? "Posting…" : "Post bundle"}</button>
    </form></div></main>;
}
