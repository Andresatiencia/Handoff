"use client";

import Link from "next/link";
import { createContext, useContext } from "react";
import type { User } from "@/lib/contracts";
import { useRemote } from "@/lib/api-client";
import { FlowIntro } from "./flow-intro";
import { VerifyEmailPrompt } from "./verify-email-prompt";

const AuthContext = createContext<{ user: User | null; loading: boolean; error: string; refresh: () => void }>({ user: null, loading: true, error: "", refresh: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, error, refresh } = useRemote<{ user: User | null }>("auth/me", 30000);
  return <AuthContext.Provider value={{ user: data?.user ?? null, loading, error, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function AccountGate({ next, children }: { next: string; children: React.ReactNode }) {
  const { user, loading, error, refresh } = useAuth();
  if (loading) return <main className="page-width py-16"><p className="empty-state" role="status">Checking your account…</p></main>;
  if (error) return <main className="page-width py-16"><h1>Let&apos;s reconnect.</h1><p role="alert" className="mt-6">{error}</p><button onClick={refresh} className="button-secondary mt-4">Try again</button></main>;
  if (!user) return <main className="page-width task-page py-10 sm:py-16"><div className="flow-layout"><FlowIntro title={next.startsWith("/messages") ? "A good handoff starts with hello." : "Make your next handoff."} description="A few familiar essentials. A new place to call home. Join the students making the change of semester a little easier." /><section className="form-panel"><h2>You&apos;re almost there.</h2><p className="my-5 leading-7 text-muted">Sign in or create an account to post items and send private messages to other students.</p><div className="auth-gate-actions"><Link href={`/account?next=${encodeURIComponent(next)}`} className="button-primary">Sign in or create account</Link><Link href="/marketplace" className="text-link">Keep exploring the marketplace</Link></div></section></div></main>;
  if (user.emailVerificationRequired) return <main className="page-width task-page py-10 sm:py-16"><div className="flow-layout"><FlowIntro title="One more step, then your handoff." description="Confirm your email to post items and send private messages. You can still explore while you wait." /><VerifyEmailPrompt email={user.email} /></div></main>;
  return children;
}
