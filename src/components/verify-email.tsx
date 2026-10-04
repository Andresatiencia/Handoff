"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "./auth-provider";

export function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api("auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
      setVerified(true); refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not verify this email."); }
    finally { setBusy(false); }
  }

  return <main className="page-width py-16"><div className="mx-auto max-w-lg rounded-3xl border border-ink/10 bg-white p-8 shadow-sm">
    {verified ? <><p className="eyebrow">You&apos;re all set</p><h1 className="mt-3 text-3xl font-semibold">Email verified.</h1><p className="mt-4 text-sm leading-6 text-muted">Your address is confirmed. You can now post, claim bundles, and message other students.</p><Link href="/marketplace" className="button-primary mt-6">Explore marketplace</Link></>
      : <><p className="eyebrow">Confirm your address</p><h1 className="mt-3 text-3xl font-semibold">Verify your Handoff email.</h1><p className="mt-4 text-sm leading-6 text-muted">Press the button to confirm you can receive email at the address used for your account.</p>{token ? <button type="button" disabled={busy} onClick={verify} className="button-primary mt-6 disabled:opacity-60">{busy ? "Verifying…" : "Verify email"}</button> : <p className="mt-5 text-sm text-red-700">This link is missing its verification code.</p>}{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<p className="mt-6 text-xs text-muted">Link expired? Sign in and request a new verification email from your account.</p><Link href="/account" className="nav-link mt-3 inline-block">Go to account →</Link></>}
  </div></main>;
}
