import Link from "next/link";
import { HandoffHero } from "@/components/handoff-hero";
import { RecentListings } from "@/components/recent-listings";
import { Arrow } from "@/components/icons";
export default function Home() {
  return <main><HandoffHero /><section className="page-width handoff-explained"><h2>One semester ends.<br /><em>Another begins.</em></h2><div><h3>Start with your dates.</h3><p>Tell us when you arrive or leave. Find essentials with a pickup window that works for you.</p><Link href="/arriving" className="text-link">Plan your arrival <Arrow /></Link></div><div><h3>Make the handoff yours.</h3><p>Explore real student listings, message the seller and arrange your pickup together.</p><Link href="/leaving" className="text-link">Plan your departure <Arrow /></Link></div></section><section className="page-width home-listings"><div className="section-heading"><div><h2>Ready for their next chapter.</h2><p>Available essentials, posted by students.</p></div><Link href="/marketplace" className="text-link">Explore marketplace <Arrow /></Link></div><RecentListings /></section><section className="page-width"><div className="closing-note"><h2>Less to pack.<br /><em>More to pass on.</em></h2><div><p>Moving on? Help the next student feel at home.</p><Link href="/sell" className="button-primary">Post your first essential <Arrow /></Link></div></div></section></main>;
}
