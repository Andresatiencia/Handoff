"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, reload, type User as FirebaseUser } from "firebase/auth";
import type { User } from "@/lib/contracts";
import { api } from "@/lib/api-client";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase-client";
import { FlowIntro } from "./flow-intro";
import { VerifyEmailPrompt } from "./verify-email-prompt";

type AuthState = { user: User | null; firebaseUser: FirebaseUser | null; loading: boolean; error: string; refresh: () => void };
const AuthContext = createContext<AuthState>({ user: null, firebaseUser: null, loading: true, error: "", refresh: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = firebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState(configured ? "" : "Firebase Authentication is not configured yet.");
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => { setVersion(value => value + 1); }, []);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    let sequence = 0;
    const unsubscribe = onIdTokenChanged(firebaseAuth(), async identity => {
      if (!active) return;
      const current = ++sequence;
      setFirebaseUser(identity);
      if (!identity) { setUser(null); setError(""); setLoading(false); return; }
      try {
        const result = await api<{ user: User | null }>("auth/me");
        if (active && current === sequence) { setUser(result.user); setError(""); }
      } catch (failure) {
        if (active && current === sequence) { setUser(null); setError(failure instanceof Error ? failure.message : "Could not load your account."); }
      } finally { if (active && current === sequence) setLoading(false); }
    }, failure => { if (active) { setError(failure.message); setLoading(false); } });
    return () => { active = false; unsubscribe(); };
  }, [configured, version]);

  const refreshVerification = useCallback(async () => {
    try {
      const identity = firebaseAuth().currentUser;
      if (identity) { await reload(identity); await identity.getIdToken(true); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not refresh your account."); }
    refresh();
  }, [refresh]);
  const refreshAccount = useCallback(() => { void refreshVerification(); }, [refreshVerification]);

  return <AuthContext.Provider value={{ user, firebaseUser, loading, error, refresh: refreshAccount }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function AccountGate({ next, children }: { next: string; children: React.ReactNode }) {
  const { user, firebaseUser, loading, error, refresh } = useAuth();
  if (loading) return <main className="page-width py-16"><p className="empty-state" role="status">Checking your account…</p></main>;
  if (error) return <main className="page-width py-16"><h1>Let&apos;s reconnect.</h1><p role="alert" className="mt-6">{error}</p><button onClick={refresh} className="button-secondary mt-4">Try again</button></main>;
  if (!user) return <main className="page-width task-page py-10 sm:py-16"><div className="flow-layout"><FlowIntro title="Make your next handoff." description="A few familiar essentials. A new place to call home. Join the students making the change of semester a little easier." /><section className="form-panel"><h2>{firebaseUser ? "Complete your Handoff profile." : "You're almost there."}</h2><p className="my-5 leading-7 text-muted">{firebaseUser ? "Connect your account to a Handoff profile before posting or messaging." : "Sign in or create an account to post items and send private messages to other students."}</p><div className="auth-gate-actions"><Link href={`/account?next=${encodeURIComponent(next)}`} className="button-primary">{firebaseUser ? "Go to account" : "Sign in or create account"}</Link><Link href="/marketplace" className="text-link">Keep exploring the marketplace</Link></div></section></div></main>;
  if (user.emailVerificationRequired) return <main className="page-width task-page py-10 sm:py-16"><div className="flow-layout"><FlowIntro title="One more step, then your handoff." description="Confirm your email to post items and send private messages. You can still explore while you wait." /><VerifyEmailPrompt email={user.email} /></div></main>;
  return children;
}
