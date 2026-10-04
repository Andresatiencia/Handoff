"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAuth } from "./auth-provider";
import { FlowIntro } from "./flow-intro";
import { VerifyEmailPrompt } from "./verify-email-prompt";

export function VerifyEmail() {
  const { user, firebaseUser, loading, refresh } = useAuth();
  const checkedUid = useRef<string | null>(null);
  useEffect(() => {
    if (!firebaseUser || firebaseUser.emailVerified) return;
    if (checkedUid.current === firebaseUser.uid) return;
    checkedUid.current = firebaseUser.uid;
    refresh();
  }, [firebaseUser, refresh]);

  return <main className="page-width task-page py-10 sm:py-16"><div className="flow-layout">
    <FlowIntro title={user?.emailVerified ? "Your email is confirmed." : "One more step, then your handoff."} description={user?.emailVerified ? "Good things are ready for their next chapter." : "Confirm your address to take part in a student-to-student handoff."} />
    {loading ? <p role="status" className="form-panel">Checking your email…</p>
      : user?.emailVerified ? <section className="form-panel"><h2>Email verified.</h2><p className="mt-5 text-sm text-muted">You can now post, claim bundles, and message other students.</p><Link href="/marketplace" className="button-primary mt-6">Explore marketplace</Link></section>
      : firebaseUser ? <VerifyEmailPrompt email={firebaseUser.email ?? "your address"} />
      : <section className="form-panel"><h2>Sign in first.</h2><p className="mt-5 text-sm text-muted">Sign in to check your verification status.</p><Link href="/account" className="button-primary mt-6">Go to account</Link></section>}
  </div></main>;
}
