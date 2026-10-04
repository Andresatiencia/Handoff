"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "./auth-provider";
import { FlowIntro } from "./flow-intro";

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

  return <main className="page-width task-page py-10 sm:py-16"><div className="flow-layout">
    <FlowIntro title={verified ? "Your email is confirmed." : "One more step, then your handoff."} description={verified ? "Good things are ready for their next chapter. You can now post, claim bundles and message other students." : "Confirm your address to take part in a student-to-student handoff."} />
    <section className="form-panel">
      {verified ? <><h2>Email verified.</h2><p role="status" className="mt-5 text-sm leading-7 text-muted">Your address is confirmed. You can now post, claim bundles, and message other students.</p><Link href="/marketplace" className="button-primary mt-6">Explore marketplace</Link></>
        : <><h2>Verify your email.</h2><p className="mt-5 text-sm leading-7 text-muted">Press the button to confirm you can receive email at the address used for your account.</p>{token ? <button type="button" disabled={busy} onClick={verify} className="button-primary mt-6">{busy ? "Verifying…" : "Verify email"}</button> : <p role="alert" className="mt-5 text-sm">This link is missing its verification code.</p>}{error && <p role="alert" className="mt-4 text-sm">{error}</p>}<p className="mt-6 text-xs leading-6 text-muted">Link expired? Sign in and request a new verification email from your account.</p><Link href="/account" className="text-link mt-3">Go to account</Link></>}
    </section>
  </div></main>;
}
