"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Category } from "@/lib/listings";
import { CategorySelector } from "./category-selector";
import { DateInput } from "./date-input";
import { UniversitySelect } from "./university-select";
import { Arrow } from "./icons";
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
    router.push(`/marketplace?${params}`);
  }
  return <main className="page-width py-10 sm:py-16"><Link href="/" className="nav-link">← Back to home</Link><div className="mx-auto mt-8 max-w-xl"><p className="eyebrow">{arriving ? "A new campus. A softer landing." : "Your next chapter starts here."}</p><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{arriving ? "Make yourself at home." : "Good things deserve a handoff."}</h1><p className="mt-5 leading-7 text-muted">{arriving ? "Tell us when you’re arriving and what you need. Let’s get your new chapter off to a good start." : "Moving on? Help another student settle in. Start with your university and the day you’re leaving."}</p><form onSubmit={submit} className="mt-8 space-y-6 rounded-3xl border border-ink/10 bg-white p-6 shadow-sm sm:p-8"><DateInput label={arriving ? "When are you arriving?" : "When are you leaving?"} name="date"/><UniversitySelect />{arriving && <CategorySelector selected={selected} onChange={setSelected}/>}<button className="button-primary w-full" type="submit">{arriving ? "Find Items" : "Start Listing Items"}<Arrow /></button><p className="text-center text-xs leading-5 text-muted">A little less waste. A little more community.<br/>University of Central Missouri</p></form></div></main>;
}
