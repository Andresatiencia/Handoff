"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { Conversation } from "@/lib/contracts";
import { useRemote } from "@/lib/api-client";
import { useAuth } from "./auth-provider";
import { Arrow, LogoMark } from "./icons";
import { UnreadBadge } from "./unread-badge";
export function Header() {
  const { user } = useAuth();
  const { data, refresh } = useRemote<{ conversations: Conversation[] }>(user ? "conversations" : null, 10000);
  const unread = data?.conversations.reduce((total, conversation) => total + Number(conversation.unreadCount), 0) ?? 0;
  useEffect(() => {
    window.addEventListener("handoff:messages-changed", refresh);
    return () => window.removeEventListener("handoff:messages-changed", refresh);
  }, [refresh]);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = [["/marketplace", "Marketplace"], ["/arriving", "Arriving"], ["/leaving", "Leaving"], ["/messages", "Messages"]];
  return <header className="site-header"><div className="page-width header-inner">
    <Link href="/" aria-label="Handoff home" className="wordmark" onClick={() => setOpen(false)}><LogoMark />handoff</Link>
    <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={open ? "M6 6l12 12M6 18L18 6" : "M4 8h16M4 16h16"}/></svg></button>
    <nav id="main-navigation" aria-label="Main navigation" className={`main-navigation ${open ? "is-open" : ""}`} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); document.querySelector<HTMLButtonElement>(".menu-toggle")?.focus(); } }}>
      {links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)}>{label}{href === "/messages" && unread > 0 && <><UnreadBadge count={unread} /><span className="sr-only">{unread} unread messages</span></>}</Link>)}
      <Link href="/sell" className="nav-publish" aria-current={pathname === "/sell" ? "page" : undefined} onClick={() => setOpen(false)}>Post an item</Link>
      <Link href="/account" className="nav-account" aria-current={pathname === "/account" ? "page" : undefined} onClick={() => setOpen(false)}>{user ? "Your account" : "Sign in"}<Arrow /></Link>
    </nav>
  </div></header>;
}
