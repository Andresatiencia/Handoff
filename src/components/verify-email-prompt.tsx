"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";

export function VerifyEmailPrompt({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resend() {
    setBusy(true); setError(""); setMessage("");
    try {
      await api("auth/resend-verification", { method: "POST" });
      setMessage("A fresh verification link is on its way. Check your inbox and spam folder.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not send the email."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-3xl border border-forest/20 bg-white p-7 shadow-sm">
    <p className="eyebrow">One more step</p><h2 className="mt-2 text-2xl font-semibold">Verify your email</h2>
    <p className="mt-3 text-sm leading-6 text-muted">Check <strong className="break-all text-ink">{email}</strong> for your verification link. Open it to confirm you control this address. You can browse while you wait; posting, claiming, and messaging unlock after verification.</p>
    <button type="button" onClick={resend} disabled={busy} className="button-secondary mt-5 disabled:opacity-60">{busy ? "Sending…" : "Resend verification email"}</button>
    {message && <p role="status" className="mt-3 text-sm text-forest">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
