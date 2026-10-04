import Link from "next/link";
export default function NotFound() {
  return <main className="page-width task-page py-16"><section className="empty-state"><h1>This chapter is missing.</h1><p className="mt-5 text-muted">We couldn’t find that page. Find your way back to the essentials.</p><Link href="/marketplace" className="button-primary mt-6">Explore the marketplace</Link></section></main>;
}
