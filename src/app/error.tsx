"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="page-width task-page py-16"><section className="empty-state"><h1>Let’s try that again.</h1><p role="alert" className="mt-5">Something interrupted this page. Please retry.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button className="button-primary" onClick={reset}>Try again</button><Link href="/" className="button-secondary">Back to home</Link></div></section></main>;
}
