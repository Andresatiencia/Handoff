"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Category } from "@/lib/listings";
import { CategorySelector } from "./category-selector";
import { DateInput } from "./date-input";
import { UniversitySelect } from "./university-select";
import { FlowIntro } from "./flow-intro";

export function StudentForm({ mode }: { mode: "leaving" | "arriving" }) {
  const arriving = mode === "arriving";
  const router = useRouter();
  const [selected, setSelected] = useState<Category[]>([]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const university = String(data.get("university")).trim();
    const date = String(data.get("date"));
    if (!arriving) { router.push(`/sell?${new URLSearchParams({ departure: date, university })}`); return; }
    const params = new URLSearchParams({ arrival: date, university });
    if (selected.length) params.set("categories", selected.join(","));
    const needs = String(data.get("needs") ?? "").split(",").map(value => value.trim()).filter(Boolean).slice(0, 8).join(",");
    if (needs) params.set("needs", needs);
    router.push(`/marketplace?${params}`);
  }

  return <main className="page-width task-page py-10 sm:py-16">
    <Link href="/" className="nav-link">← Back to home</Link>
    <div className="flow-layout">
      <FlowIntro title={arriving ? "Make yourself at home." : "Good things deserve a handoff."} description={arriving ? "Tell us when you're arriving and what you need. Find essentials and bundles that fit your next chapter." : "Moving on? Help another student settle in. Start with your university and the day you're leaving."} image={arriving ? "chair" : "kitchen"}><div className="flow-progress"><span>Your dates</span><span>{arriving ? "Your essentials" : "Your listing"}</span><span>Your handoff</span></div></FlowIntro>
      <form onSubmit={submit} className="form-panel space-y-6">
        <DateInput label={arriving ? "When are you arriving?" : "When are you leaving?"} name="date" />
        <UniversitySelect />
        {arriving && <>
          <CategorySelector selected={selected} onChange={setSelected} />
          <label className="block text-sm font-semibold">Specific items you need <span className="font-normal text-muted">(optional)</span>
            <input name="needs" className="form-input mt-2" maxLength={240} placeholder="Mini fridge, microwave, desk lamp" />
            <span className="mt-2 block text-xs font-normal text-muted">Separate up to 8 items with commas for a more useful bundle match.</span>
          </label>
        </>}
        <button className="button-primary w-full" type="submit">{arriving ? "Find items" : "Start listing items"}</button>
        <p className="text-center text-xs leading-5 text-muted">A little less waste. A little more community.<br />University of Central Missouri</p>
      </form>
    </div>
  </main>;
}
