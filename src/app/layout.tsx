import type { Metadata } from "next";
import Link from "next/link";
import { AuthProvider } from "@/components/auth-provider";
import { Header } from "@/components/header";
import { LogoMark } from "@/components/icons";
import "./globals.css";
export const metadata: Metadata = { title: "Handoff — Good things. New beginnings.", description: "Students leaving have what arriving students need. Find campus essentials that fit your move-in dates." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#content">Skip to content</a><AuthProvider><Header /><div id="content" className="app-content" tabIndex={-1}>{children}</div><footer className="site-footer"><div className="page-width footer-inner"><div><Link href="/" className="wordmark"><LogoMark />handoff</Link><p>Good things. New beginnings.</p></div><nav aria-label="Footer navigation"><Link href="/marketplace">Explore essentials</Link><Link href="/sell">Pass something on</Link><Link href="/bundles/new">Create a bundle</Link><Link href="/account">Your account</Link></nav><p className="campus-note">Student to student.<br />University of Central Missouri</p></div></footer></AuthProvider></body></html>;
}
