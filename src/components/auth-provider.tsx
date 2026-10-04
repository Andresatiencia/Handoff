"use client";

import Link from "next/link";
import { createContext, useContext } from "react";
import type { User } from "@/lib/contracts";
import { useRemote } from "@/lib/api-client";

const AuthContext = createContext<{ user: User | null; loading: boolean; error: string; refresh: () => void }>({ user: null, loading: true, error: "", refresh: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, error, refresh } = useRemote<{ user: User | null }>("auth/me", 30000);
  return <AuthContext.Provider value={{ user: data?.user ?? null, loading, error, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function AccountGate({ next, children }: { next: string; children: React.ReactNode }) {
  const { user, loading, error, refresh } = useAuth();
  if (loading) return <p className="page-width py-16" role="status">Checking your account…</p>;
  if (error) return <div className="page-width py-16"><p role="alert">{error}</p><button onClick={refresh} className="button-secondary mt-4">Try again</button></div>;
  if (!user) return <main className="page-width py-16"><div className="mx-auto max-w-lg rounded-3xl border border-ink/10 bg-white p-8"><h1 className="display-lg">Make your next handoff.</h1><p className="my-5 leading-7 text-muted">Sign in or create an account to post items and send private messages to other students.</p><Link href={`/account?next=${encodeURIComponent(next)}`} className="button-primary">Sign in or create account</Link></div></main>;
  return children;
}
