"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { api } from "@/lib/api-client";
import { firebaseAuth } from "@/lib/firebase-client";
import { useAuth } from "./auth-provider";
import { UniversitySelect } from "./university-select";
import { FlowIntro } from "./flow-intro";
import { VerifyEmailPrompt } from "./verify-email-prompt";

function authError(error: unknown) {
  const code = (error as { code?: string }).code;
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "This email already has a Firebase account. Sign in or reset its password.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/weak-password": "Choose a stronger password.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase yet.",
    "auth/unauthorized-domain": "This site must be added to Firebase Authorized domains.",
  };
  return (code && messages[code]) || (error instanceof Error ? error.message : "Authentication failed. Please try again.");
}

export function Account() {
  const { user, firebaseUser, loading, error: providerError, refresh } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const requested = params.get("next") ?? "/marketplace";
  const next = /^\/(?!\/)/.test(requested) && !requested.includes("\\") ? requested : "/marketplace";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setBusy(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const email = String(fields.email).trim().toLowerCase();
    try {
      if (reset) {
        await sendPasswordResetEmail(firebaseAuth(), email, { url: `${window.location.origin}/account` });
        setNotice("If this email has an account, a password reset link is on its way.");
      } else if (register) {
        const credential = await createUserWithEmailAndPassword(firebaseAuth(), email, String(fields.password));
        await updateProfile(credential.user, { displayName: String(fields.name).trim() });
        try {
          await api("auth/profile", { method: "POST", body: JSON.stringify({ name: fields.name, university: fields.university }) });
        } catch (failure) {
          setError(authError(failure));
        }
        try {
          await sendEmailVerification(credential.user, { url: `${window.location.origin}/verify-email` });
          setNotice("Verification email sent. Check your inbox and click the verification link.");
        } catch (failure) { setError(authError(failure)); }
        refresh(); router.push("/account");
      } else {
        const credential = await signInWithEmailAndPassword(firebaseAuth(), email, String(fields.password));
        refresh(); router.push(credential.user.emailVerified ? next : "/account");
      }
    } catch (failure) { setError(authError(failure)); }
    finally { setBusy(false); }
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try { await api("auth/profile", { method: "POST", body: JSON.stringify(fields) }); refresh(); }
    catch (failure) { setError(authError(failure)); }
    finally { setBusy(false); }
  }

  async function migrate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    try { await api("auth/migrate", { method: "POST", body: JSON.stringify({ password }) }); refresh(); setNotice("Your earlier Handoff profile is connected."); }
    catch (failure) { setError(authError(failure)); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError("");
    try { await signOut(firebaseAuth()); refresh(); router.push("/"); }
    catch (failure) { setError(authError(failure)); }
    finally { setBusy(false); }
  }

  return <main className="page-width task-page py-10 sm:py-16"><div className="flow-layout">
    <FlowIntro title={user ? `Hi, ${user.name}.` : firebaseUser ? "Finish your Handoff profile." : register ? "Start your next chapter." : "Welcome back."}
      description={user?.emailVerificationRequired ? "One more step before your next handoff. Confirm your email, then post and message students." : user ? "Your essentials, your conversations and your next handoff. All in one place." : "Join the students passing good things on. Your next handoff starts here."} />
    <div>{loading ? <p role="status" className="form-panel">Loading account…</p> : user ? <div className="space-y-5">
      {user.emailVerificationRequired && <VerifyEmailPrompt email={user.email} />}
      <section className="form-panel space-y-5"><h2>Your account</h2><p className="break-words">{user.email}</p><p className="text-sm text-muted">{user.university}</p><div className="account-actions">{user.emailVerificationRequired ? <Link className="button-secondary" href="/marketplace">Explore marketplace</Link> : <><Link className="button-primary" href="/marketplace?mine=true">Manage my listings</Link><Link className="button-secondary" href="/messages">Your messages</Link><Link className="button-secondary" href="/sell">Post an item</Link></>}<button disabled={busy} onClick={logout} className="text-link">{busy ? "Signing out…" : "Sign out"}</button></div></section>
    </div> : firebaseUser ? <div className="space-y-5">
      <section className="form-panel space-y-5"><h2>Connect your Handoff profile</h2><p className="text-sm text-muted">Signed in to Firebase as {firebaseUser.email}. Your Handoff listings and messages stay in the existing database.</p>
        <form onSubmit={createProfile} className="space-y-4"><label className="block text-sm font-semibold">Your name<input name="name" defaultValue={firebaseUser.displayName ?? ""} required maxLength={60} className="form-input mt-2" /></label><UniversitySelect /><button disabled={busy} className="button-primary w-full">Create new profile</button></form>
        <div className="border-t border-ink/10 pt-5"><h3 className="font-semibold">Already used Handoff?</h3><p className="mt-2 text-sm text-muted">Enter your previous Handoff password to keep your existing profile, listings and messages. Your old password will not be used again afterward.</p><form onSubmit={migrate} className="mt-4 space-y-3"><input type="password" name="password" required minLength={12} maxLength={128} autoComplete="current-password" className="form-input" placeholder="Previous Handoff password" /><button disabled={busy} className="button-secondary w-full">Connect existing profile</button></form></div>
        <button disabled={busy} onClick={logout} className="text-link">Sign out</button>
      </section>
    </div> : <form onSubmit={submit} className="form-panel space-y-5">
      <h2>{reset ? "Reset your password" : register ? "Create your account" : "Sign in"}</h2>
      {register && !reset && <><label className="block text-sm font-semibold">Your name<input name="name" autoComplete="name" required maxLength={60} className="form-input mt-2" /></label><UniversitySelect /></>}
      <label className="block text-sm font-semibold">Email<input type="email" name="email" autoComplete="email" required maxLength={254} className="form-input mt-2" /></label>
      {!reset && <label className="block text-sm font-semibold">Password<input type="password" name="password" autoComplete={register ? "new-password" : "current-password"} required minLength={12} maxLength={128} className="form-input mt-2" /></label>}
      {register && <p className="text-xs text-muted">Use at least 12 characters. Firebase will send an email verification link.</p>}
      <button disabled={busy} className="button-primary w-full disabled:opacity-50">{busy ? "Please wait…" : reset ? "Send reset link" : register ? "Create account" : "Sign in"}</button>
      <button type="button" disabled={busy} className="min-h-11 w-full text-sm font-semibold text-forest" onClick={() => { setRegister(false); setReset(!reset); setError(""); }}>{reset ? "Back to sign in" : "Forgot password?"}</button>
      {!reset && <button type="button" disabled={busy} className="min-h-11 w-full text-sm font-semibold text-forest" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Already a member? Sign in" : "New to Handoff? Create account"}</button>}
    </form>}
    {notice && <p role="status" className="mt-4 text-sm text-forest">{notice}</p>}
    {(error || providerError) && <p role="alert" className="mt-4 text-sm text-red-700">{error || providerError}{providerError && <button type="button" className="text-link ml-3 underline" onClick={refresh}>Try again</button>}</p>}
    </div></div></main>;
}
