"use client";
import Link from "next/link";
import { useAuth } from "./auth-provider";

export function Header() {
  const { user } = useAuth();
  return <header className="border-b border-ink/10">
    <div className="page-width flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
      <Link href="/" aria-label="Handoff home" className="display text-[1.6rem] leading-none text-forest">
        Handoff<span className="text-amber">.</span>
      </Link>
      <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-5 sm:gap-7">
        <Link className="nav-link" href="/marketplace">Browse</Link>
        <Link className="nav-link" href="/messages">Messages</Link>
        <Link className="nav-link" href="/account">{user ? "My account" : "Sign in"}</Link>
        <Link
          href="/sell"
          className="inline-flex min-h-9 items-center rounded-full border border-forest/25 px-4 text-sm font-medium text-forest"
          style={{ transition: "transform var(--press) var(--ease-out), background-color var(--press) var(--ease-out)" }}
        >
          Post an item
        </Link>
      </nav>
    </div>
  </header>;
}
