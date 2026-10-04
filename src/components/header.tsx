"use client";
import { useAuth } from "./auth-provider";
import Link from "next/link";
import { Arrow, LogoMark } from "./icons";
export function Header() {
  const { user } = useAuth();
  return <header className="border-b border-ink/10"><div className="page-width flex min-h-21 flex-wrap items-center justify-between gap-4 py-4"><Link href="/" aria-label="Handoff home" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-forest"><LogoMark />Handoff<span className="text-coral">.</span></Link><nav aria-label="Main navigation" className="flex flex-wrap items-center gap-3 sm:gap-6"><Link className="nav-link" href="/messages">Messages</Link><Link className="nav-link" href="/marketplace">Browse items</Link><Link className="hidden items-center gap-2 rounded-full border border-forest/25 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 sm:flex" href="/sell">Post an item <Arrow /></Link><Link href="/account" className="nav-link">{user ? "My account" : "Sign in"}</Link></nav></div></header>;
}
