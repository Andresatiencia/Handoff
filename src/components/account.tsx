"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import type { User } from "@/lib/contracts";
import { useAuth } from "./auth-provider";
import { UniversitySelect } from "./university-select";
import { FlowIntro } from "./flow-intro";

export function Account({ googleEnabled }: { googleEnabled: boolean }) {
  const { user, loading, error: authError, refresh } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requested = params.get("next") ?? "/marketplace";
  const next = /^\/(?!\/)/.test(requested) && !requested.includes("\\") ? requested : "/marketplace";
  const googleLink = `/api/auth/google/start?next=${encodeURIComponent(user ? "/account" : next)}`;
  const googleError = params.get("google_error");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api<{ user: User }>(`auth/${register ? "register" : "login"}`, { method: "POST", body: JSON.stringify(fields) });
      refresh();
      router.push(next);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError("");
    try { await api("auth/logout", { method: "POST" }); refresh(); router.push("/"); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not sign out."); }
    finally { setBusy(false); }
  }

  return <main className="page-width task-page py-10 sm:py-16"><div className="flow-layout">
    <FlowIntro title={user ? `Hi, ${user.name}.` : register ? "Start your next chapter." : "Welcome back."} description={user ? "Your essentials, your conversations and your next handoff. All in one place." : "Join the students passing good things on. Your next handoff starts here."} />
    <div>{loading ? <p role="status" className="form-panel">Loading account…</p> : user ? <div className="space-y-5">
      {googleEnabled && <Link href={googleLink} className="button-secondary w-full text-center">Connect Google</Link>}
      <section className="form-panel space-y-5"><h2>Your account</h2><p className="break-words">{user.email}</p><p className="text-sm text-muted">{user.university}</p><div className="account-actions"><Link className="button-primary" href="/marketplace?mine=true">Manage my listings</Link><Link className="button-secondary" href="/messages">Your messages</Link><Link className="button-secondary" href="/sell">Post an item</Link><button disabled={busy} onClick={logout} className="text-link">{busy ? "Signing out…" : "Sign out"}</button></div></section>
    </div> : <form onSubmit={submit} className="form-panel space-y-5">
      <h2>{register ? "Create your account" : "Sign in"}</h2>
      {googleEnabled && <><Link href={googleLink} className="button-secondary w-full text-center">Continue with Google</Link><p className="text-center text-xs text-muted">or use your email and password</p></>}
      {register && <><label className="block text-sm font-semibold">Your name<input name="name" autoComplete="name" required maxLength={60} className="form-input mt-2" /></label><UniversitySelect /></>}
      <label className="block text-sm font-semibold">Email<input type="email" name="email" autoComplete="email" required maxLength={254} className="form-input mt-2" /></label>
      <label className="block text-sm font-semibold">Password<input type="password" name="password" autoComplete={register ? "new-password" : "current-password"} required minLength={12} maxLength={128} className="form-input mt-2" /></label>
      <p className="text-xs text-muted">Use at least 12 characters. Your email is kept private.</p>
      <button disabled={busy} className="button-primary w-full disabled:opacity-50">{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
      <button type="button" disabled={busy} className="min-h-11 w-full text-sm font-semibold text-forest" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Already a member? Sign in" : "New to Handoff? Create account"}</button>
    </form>}
    {(error || authError || googleError) && <p role="alert" className="mt-4 text-sm text-red-700">{error || authError || googleError}{authError && <button type="button" className="text-link ml-3 underline" onClick={refresh}>Try again</button>}</p>}
    </div></div></main>;
}
