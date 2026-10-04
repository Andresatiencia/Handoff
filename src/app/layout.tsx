import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import Link from "next/link";
import { AuthProvider } from "@/components/auth-provider";
import { Header } from "@/components/header";
import "./globals.css";

// Fraunces carries the warmth; Instrument Sans stays out of its way.
const display = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-display-face" });
const body = Instrument_Sans({ subsets: ["latin"], display: "swap", variable: "--font-body" });
export const metadata: Metadata = { title: "Handoff — A new chapter, a little easier", description: "Students leaving have what arriving students need. Pass on campus essentials and make a new place feel like home." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${display.variable} ${body.variable}`}><body><AuthProvider><Header />{children}<footer className="mt-auto border-t border-ink/10"><div className="page-width flex flex-col justify-between gap-3 py-7 text-xs text-muted sm:flex-row"><Link href="/" className="font-semibold text-forest">Handoff. Made for the next chapter.</Link><p>A student-to-student marketplace at the University of Central Missouri</p></div></footer></AuthProvider></body></html>;
}
