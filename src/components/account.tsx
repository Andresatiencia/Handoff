"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "./auth-provider";
import { UniversitySelect } from "./university-select";

export function Account() {
  const { user, loading, error: authError, refresh } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requested = params.get("next") ?? "/marketplace";
  const next = /^\/(?!\/)/.test(requested) && !requested.includes("\\") ? requested : "/marketplace";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`auth/${register ? "register" : "login"}`, { method: "POST", body: JSON.stringify(fields) });
      refresh(); router.push(next);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError("");
    try { await api("auth/logout", { method: "POST" }); refresh(); router.push("/"); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not sign out."); }
    finally { setBusy(false); }
  }

  return <main className="page-width py-16"><div className="mx-auto max-w-lg">
    
    <h1 className="display-lg mt-3">{user ? `Hi, ${user.name}.` : register ? "Start your next chapter." : "Welcome back."}</h1>
    {loading ? <p className="mt-6">Loading account…</p> : user ? <section className="mt-8 space-y-5 rounded-3xl border border-ink/10 bg-white p-8"><p className="break-words">{user.email}</p><p className="text-sm text-muted">{user.university}</p><Link className="button-primary" href="/marketplace?mine=true">Manage my listings</Link><button disabled={busy} onClick={logout} className="button-secondary ml-2">Sign out</button></section> : <form onSubmit={submit} className="mt-8 space-y-5 rounded-3xl border border-ink/10 bg-white p-8">
      {register && <><label className="block text-sm font-semibold">Your name<input name="name" autoComplete="name" required maxLength={60} className="form-input mt-2" /></label><UniversitySelect /></>}
      <label className="block text-sm font-semibold">Email<input type="email" name="email" autoComplete="email" required maxLength={254} className="form-input mt-2" /></label>
      <label className="block text-sm font-semibold">Password<input type="password" name="password" autoComplete={register ? "new-password" : "current-password"} required minLength={12} maxLength={128} className="form-input mt-2" /></label>
      <p className="text-xs text-muted">Use at least 12 characters. Your email is kept private.</p>
      <button disabled={busy} className="button-primary w-full disabled:opacity-50">{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
      <button type="button" className="w-full text-sm font-semibold text-forest" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Already a member? Sign in" : "New to Handoff? Create account"}</button>
    </form>}
    {(error || authError) && <p role="alert" className="mt-4 text-sm text-red-700">{error || authError}</p>}
  </div></main>;
}
