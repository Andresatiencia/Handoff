"use client";

import { useState } from "react";
import { reload, sendEmailVerification } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { useAuth } from "./auth-provider";

export function VerifyEmailPrompt({ email }: { email: string }) {
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resend() {
    const identity = firebaseAuth().currentUser;
    if (!identity || busy || cooldown) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await sendEmailVerification(identity, { url: `${window.location.origin}/verify-email` });
      setMessage("Verification email sent. Check your inbox and click the verification link.");
      setCooldown(true);
      window.setTimeout(() => setCooldown(false), 60_000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not send the verification email."); }
    finally { setBusy(false); }
  }

  async function check() {
    const identity = firebaseAuth().currentUser;
    if (!identity || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await reload(identity);
      await identity.getIdToken(true);
      refresh();
      setMessage(identity.emailVerified ? "Email verified. Your Handoff features are unlocked." : "Your email is not verified yet. Check your inbox and click the link.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not refresh your verification status."); }
    finally { setBusy(false); }
  }

  return <section className="form-panel">
    <h2>Check your email.</h2>
    <p className="mt-5 text-sm leading-7 text-muted">Check <strong className="break-all text-ink">{email}</strong> for your Firebase verification link. Open it to confirm your address. You can browse while you wait; posting, claiming, and messaging unlock after verification.</p>
    <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={check} disabled={busy} className="button-primary">{busy ? "Checking…" : "I've verified my email"}</button>
      <button type="button" onClick={resend} disabled={busy || cooldown} className="button-secondary disabled:opacity-50">{cooldown ? "Email sent" : "Resend verification email"}</button></div>
    {message && <p role="status" className="mt-3 text-sm text-forest">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
